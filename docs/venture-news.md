# Venture News data layer

Venture News is a Sharc instance with a static dashboard at `/venture.html` and a JSON feed at `/venture-data.json`. The dashboard shows twelve deals per chart page. The fixed window keeps company names, dates, and amounts readable while filters and pager controls still expose the entire research set.

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

The first release intentionally has no public write route. Import runs from an authenticated shell or deployment job, while `/venture-data.json` is public and read-only. A future importer can cache favicons into `static/venture-icons/` and add each local icon path to its record, avoiding third-party requests from the dashboard.
