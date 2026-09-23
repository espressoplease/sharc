#!/usr/bin/env python3
"""Local SQLite API and importer for Venture News.

The service owns structured deal data; Sharc only proxies its read-only JSON.
It deliberately uses the standard library so the deployment has no new package.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = Path(os.environ.get("VENTURE_DATA_DIR", ROOT / "arc" / "venture")) / "venture.db"
REQUIRED = ("id", "company", "date", "stage", "url", "source")

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, domain TEXT, sector TEXT, country TEXT, icon_path TEXT
);
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY, external_id TEXT NOT NULL UNIQUE, company_id INTEGER NOT NULL REFERENCES companies(id),
  announced_on TEXT NOT NULL, stage TEXT NOT NULL, amount_usd REAL, status TEXT, metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS funds (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS round_investors (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE, fund_id INTEGER NOT NULL REFERENCES funds(id),
  is_lead INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(round_id, fund_id)
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT, publisher TEXT, published_on TEXT, category TEXT, metadata_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS article_rounds (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  evidence TEXT, discovered_at TEXT NOT NULL, PRIMARY KEY(article_id, round_id)
);
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY, imported_at TEXT NOT NULL, source_name TEXT NOT NULL, record_count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rounds_date_idx ON rounds(announced_on DESC);
CREATE INDEX IF NOT EXISTS articles_date_idx ON articles(published_on DESC);
"""

def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def connect(db: Path) -> sqlite3.Connection:
    db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    con.execute("PRAGMA journal_mode=WAL")
    return con

def validate(records: object) -> list[dict]:
    if not isinstance(records, list): raise ValueError("Import must be a JSON array.")
    ids: set[str] = set()
    for index, record in enumerate(records, start=1):
        missing = [key for key in REQUIRED if not record.get(key)]
        if missing: raise ValueError(f"Record {index} is missing {', '.join(missing)}.")
        if record["id"] in ids: raise ValueError(f"Duplicate round id: {record['id']}.")
        ids.add(record["id"])
    return records

def articles_for(record: dict) -> list[dict]:
    source_articles = record.get("articles") or record.get("sources") or []
    if not source_articles: source_articles = [{"url": record["url"], "source": record["source"], "title": record.get("title"), "evidence": record.get("evidence", "")}]
    result, urls = [], set()
    for article in source_articles:
        url = article.get("url")
        if url and url not in urls:
            urls.add(url)
            result.append({"url": url, "publisher": article.get("publisher") or article.get("source") or record.get("source"), "title": article.get("title") or record.get("title"), "publishedOn": article.get("publishedOn") or record.get("date"), "category": article.get("category"), "evidence": article.get("evidence", "")})
    return result

def upsert(con: sqlite3.Connection, record: dict) -> None:
    timestamp = now()
    con.execute("INSERT INTO companies(name,domain,sector,country,icon_path) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET domain=excluded.domain,sector=excluded.sector,country=excluded.country,icon_path=excluded.icon_path", (record["company"], record.get("domain"), record.get("sector"), record.get("country") or record.get("location"), record.get("iconPath")))
    company_id = con.execute("SELECT id FROM companies WHERE name=?", (record["company"],)).fetchone()[0]
    con.execute("INSERT INTO rounds(external_id,company_id,announced_on,stage,amount_usd,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(external_id) DO UPDATE SET company_id=excluded.company_id,announced_on=excluded.announced_on,stage=excluded.stage,amount_usd=excluded.amount_usd,status=excluded.status,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at", (record["id"], company_id, record["date"], record["stage"], record.get("amountUsd"), record.get("status"), json.dumps(record), timestamp, timestamp))
    round_id = con.execute("SELECT id FROM rounds WHERE external_id=?", (record["id"],)).fetchone()[0]
    con.execute("DELETE FROM round_investors WHERE round_id=?", (round_id,))
    for name in record.get("investors", []):
        con.execute("INSERT INTO funds(name) VALUES(?) ON CONFLICT(name) DO NOTHING", (name,))
        fund_id = con.execute("SELECT id FROM funds WHERE name=?", (name,)).fetchone()[0]
        con.execute("INSERT INTO round_investors(round_id,fund_id,is_lead) VALUES(?,?,?)", (round_id, fund_id, int(name in record.get("leadInvestors", []))))
    for article in articles_for(record):
        con.execute("INSERT INTO articles(url,title,publisher,published_on,category,metadata_json) VALUES(?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,publisher=excluded.publisher,published_on=excluded.published_on,category=COALESCE(excluded.category,articles.category),metadata_json=excluded.metadata_json", (article["url"], article.get("title"), article.get("publisher"), article.get("publishedOn"), article.get("category"), json.dumps(article)))
        article_id = con.execute("SELECT id FROM articles WHERE url=?", (article["url"],)).fetchone()[0]
        con.execute("INSERT INTO article_rounds(article_id,round_id,evidence,discovered_at) VALUES(?,?,?,?) ON CONFLICT(article_id,round_id) DO UPDATE SET evidence=excluded.evidence", (article_id, round_id, article.get("evidence"), timestamp))

def import_file(db: Path, source: Path) -> int:
    records = validate(json.loads(source.read_text()))
    with connect(db) as con:
        for record in records: upsert(con, record)
        con.execute("INSERT INTO ingestion_runs(imported_at,source_name,record_count) VALUES(?,?,?)", (now(), str(source), len(records)))
    return len(records)

def deals(db: Path) -> list[dict]:
    with connect(db) as con:
        rows = con.execute("SELECT r.id,r.external_id,r.metadata_json,c.name,c.domain,c.sector,c.country,c.icon_path FROM rounds r JOIN companies c ON c.id=r.company_id ORDER BY r.announced_on DESC,c.name").fetchall()
        out = []
        for row in rows:
            item = json.loads(row["metadata_json"])
            item.update({"id": row["external_id"], "company": row["name"], "domain": row["domain"], "sector": row["sector"], "country": row["country"], "iconPath": row["icon_path"]})
            item["articles"] = [dict(article) for article in con.execute("SELECT a.url,a.title,a.publisher,a.published_on AS publishedOn,a.category,ar.evidence FROM articles a JOIN article_rounds ar ON ar.article_id=a.id WHERE ar.round_id=? ORDER BY a.published_on DESC,a.id", (row["id"],))]
            if item["articles"]:
                item["url"], item["source"] = item["articles"][0]["url"], item["articles"][0]["publisher"]
            out.append(item)
        return out

def check(db: Path) -> None:
    with connect(db) as con:
        counts = {table: con.execute(f"SELECT count(*) FROM {table}").fetchone()[0] for table in ("companies", "rounds", "articles", "article_rounds", "funds")}
        assert counts["rounds"] > 0 and counts["articles"] >= counts["rounds"]
        print(json.dumps(counts))

class Handler(BaseHTTPRequestHandler):
    db: Path
    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health": payload = {"ok": True}
        elif path == "/deals": payload = deals(self.db)
        else: self.send_error(404); return
        body = json.dumps(payload).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *_: object) -> None: pass

def serve(db: Path, port: int) -> None:
    Handler.db = db
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Venture data service listening on 127.0.0.1:{port}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("import", "check", "serve")); parser.add_argument("file", nargs="?")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB); parser.add_argument("--port", type=int, default=int(os.environ.get("VENTURE_DATA_PORT", "8787")))
    args = parser.parse_args()
    if args.command == "import":
        if not args.file: parser.error("import requires a JSON file")
        print(f"Imported {import_file(args.db, Path(args.file))} records.")
    elif args.command == "check": check(args.db)
    else: serve(args.db, args.port)
