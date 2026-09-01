# AgroPrice Dashboard

Nigeria agricultural price intelligence dashboard. The first pipeline adapter
uses the verified HDX/WFP Nigeria CSV resource.

## Fetch a smoke-test sample

```bash
python scripts/fetch_wfp_hdx.py --limit 100
```

Output is written to `data/wfp_nigeria_normalized.csv` with the fields:
`commodity`, `state`, `market`, `price_naira`, `unit`, `observation_date`, and
`source`. Missing values remain missing; the script does not interpolate.

The fetcher first asks the HDX CKAN API for the current CSV resource and falls
back to the known public resource URL if metadata lookup is unavailable.
