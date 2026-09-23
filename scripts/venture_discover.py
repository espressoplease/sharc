#!/usr/bin/env python3
"""Collect low-cost funding-round leads from public RSS feeds.

This is deliberately a discovery queue, not an auto-importer. A headline can
describe a debt facility, a cumulative total, or an old round. Researchers
verify the round before passing a JSON batch to venture_service.py import.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / "arc" / "venture" / "venture.db"
FEEDS = {
    "PR Newswire": "https://www.prnewswire.com/rss/news-releases-list.rss",
    "TechCrunch": "https://techcrunch.com/feed/",
}
ROUND = re.compile(r"\b(pre[ -]?seed|seed|series\s+[a-f]|funding\s+round|raises?\s+\$|raised\s+\$)\b", re.I)

def text(node: ET.Element, *names: str) -> str:
    for child in node:
        if child.tag.rsplit("}", 1)[-1] in names and (child.text or "").strip():
            return child.text.strip()
    return ""

def link(node: ET.Element) -> str:
    value = text(node, "link")
    if value: return value
    for child in node:
        if child.tag.rsplit("}", 1)[-1] == "link" and child.attrib.get("href"):
            return child.attrib["href"]
    return ""

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "VentureNewsResearch/0.1 (+local discovery queue)"})
    with urllib.request.urlopen(req, timeout=20) as response: return response.read()

def known_urls(db: Path) -> set[str]:
    if not db.exists(): return set()
    with sqlite3.connect(db) as con:
        return {row[0] for row in con.execute("SELECT url FROM articles")}

def discover(db: Path) -> list[dict]:
    seen, output = known_urls(db), []
    for publisher, feed in FEEDS.items():
        try:
            root = ET.fromstring(fetch(feed))
        except Exception as error:
            print(f"warning: {publisher} unavailable: {error}")
            continue
        for item in root.findall(".//{*}item") + root.findall(".//{*}entry"):
            title, url = text(item, "title"), link(item)
            if not title or not url or url in seen or not ROUND.search(title): continue
            output.append({
                "discoveredAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "publisher": publisher, "title": title, "url": url,
                "publishedAt": text(item, "pubDate", "published", "updated"),
                "reason": "Funding-stage phrase in a public RSS headline",
                "status": "needs_verification",
            })
    return sorted({item["url"]: item for item in output}.values(), key=lambda item: item["publisher"] + item["title"])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a review queue from public funding-news feeds.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    records = discover(args.db)
    payload = json.dumps(records, indent=2) + "\n"
    if args.output: args.output.write_text(payload)
    else: print(payload, end="")
