# Deploy on Vercel, not Cloudflare Workers

The course recommends Cloudflare Workers, with Google Cloud Run as a fallback, but accepts any public deployment. FastAPI on Cloudflare runs as Python Workers on Pyodide, where Postgres drivers may not work. Cloud Run needs a GCP billing setup and a second origin with CORS. With two days to the demo, we deploy one Vercel project instead:

- the Vite SPA is served at `/`
- FastAPI runs as a Python function at `/api/*`, on the same origin

`main` redeploys on every push.
