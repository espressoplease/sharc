# Venture News data layer

Venture News is a Sharc instance whose native `/news` feed carries the funding explorer above the article list. It reads its data from `/venture-data.json`. The chart shows twelve deals at a time within the same page, keeping company names, dates, and amounts readable while filters and controls still expose the entire research set.

## Storage

`static/venture-deals.seed.json` is the versioned starter dataset. The durable source of truth is `arc/venture/venture.db`, a SQLite database owned by `scripts/venture_service.py`. The `arc/` directory is already ignored by Git, so research imports remain persistent when the application code is deployed or updated.

Every record is JSON with a stable `id`, `company`, `domain`, `date`, `stage`, `amountUsd`, `sector`, `investors`, `leadInvestors`, and evidence fields. A round may carry `sources` or `articles`, each of which is stored as equal coverage in the `articles` and `article_rounds` tables. `amountUsd` is optional for undisclosed rounds.

To merge a researched batch into a local or deployed instance:

```sh
python3 scripts/venture_service.py import /path/to/new-deals.json
```

The importer validates required fields and de-duplicates by stable round id and article URL. Check the resulting database with `python3 scripts/venture_service.py check`.

### Discovery queue

`python3 scripts/venture_discover.py --output /tmp/venture-candidates.json` polls PR Newswire and TechCrunch RSS feeds, removes URLs already in the database, and writes only leads that include a funding-stage phrase. It never writes to SQLite. A researcher verifies the announcement date, stage, round amount, company domain and investors, then supplies a clean batch to the importer. This keeps broad, cheap discovery separate from factual publication.

## Deploying

Run the service with `python3 scripts/venture_service.py serve`, then the app with `PORT=8082 ./sharc venture-news.arc`. The Sharc route proxies the loopback service and falls back to the legacy JSON file while it is unavailable. On the production host, retain `arc/venture/venture.db` outside the deployment checkout or use `VENTURE_DATA_DIR`. Deploying source code with `git pull` never overwrites that runtime directory. Back it up with the rest of the Sharc `arc/` data.

`deploy/venture-news-data.service` is a systemd unit for the local data service. The research scheduler can copy a validated JSON batch to the host and run `python3 scripts/venture_service.py import /path/to/batch.json`; it does not need browser access or a public write route.

The first release intentionally has no public write route. Import runs from an authenticated shell or deployment job, while `/venture-data.json` is public and read-only. `node scripts/venture-fetch-icons.mjs` caches company favicons as flat `static/venture-icon-*.jpg` files and records each local path, avoiding third-party requests from the dashboard.
