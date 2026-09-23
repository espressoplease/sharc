# Venture News data layer

Venture News is a Sharc instance whose native `/news` feed carries the funding explorer above the article list. It reads its data from `/venture-data.json`. The chart shows twelve deals at a time within the same page, keeping company names, dates, and amounts readable while filters and controls still expose the entire research set.

## Storage

`static/venture-deals.seed.json` is the versioned starter dataset. On the first request, `venture.arc` creates `arc/venture/deals.json` from that seed. The `arc/` directory is already ignored by Git, so research imports remain persistent when the application code is deployed or updated.

Every record is JSON with a stable `id`, `company`, `domain`, `date`, `stage`, `amountUsd`, `sector`, `investors`, `leadInvestors`, `source`, `url`, and evidence fields. `amountUsd` is optional for undisclosed rounds. The original amount and currency are retained where reported.

To merge a researched batch into a local or deployed instance:

```sh
node scripts/venture-import.mjs /path/to/new-deals.json
```

The importer validates required fields, de-duplicates by `id`, and uses an atomic rename. Use `--replace` only when the supplied file is the complete canonical dataset.

## Deploying

Run the app with `PORT=8082 ./sharc venture-news.arc`. On the production host, retain `arc/venture/deals.json` outside the deployment checkout or use the existing `ARC_DATA_DIR` setting. Deploying source code with `git pull` never overwrites that runtime directory. Back it up with the rest of the Sharc `arc/` data.

The first release intentionally has no public write route. Import runs from an authenticated shell or deployment job, while `/venture-data.json` is public and read-only. `node scripts/venture-fetch-icons.mjs` caches company favicons as flat `static/venture-icon-*.jpg` files and records each local path, avoiding third-party requests from the dashboard.
