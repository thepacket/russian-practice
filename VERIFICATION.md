# Preparation verification — October 5, 2026

Passed on the final prepared source:

- `npm ci` from the included lockfile
- `npm run typecheck`
- `npm test`: 37 passed, 0 failed, no skipped tests
- `npm run build`: successful production static bundle
- Independent read-only review of the dictionary change; identified progress/timeout issues were corrected and regression-tested
- Full-corpus checks: 41,231 entries / 40,860 spellings, all caps 1–32, no repeated spelling, exact first/last eligible selection boundaries
- One-download/offline reuse, shared concurrent initialization, cancellation, interrupted streams, timeout/retry, corrupt-cache/hash rejection, denied storage/quota, and obsolete version removal
- Azure East US token CORS preflight, without a credential: HTTP 200, POST and required headers permitted

Initial application JS is approximately 116KB gzipped; the approximately 75KB gzipped Azure SDK chunk loads only on a speech request. The full dictionary is one 1,814,163-byte gzip download, then retained in memory and saved locally for reuse. Worker parsing/selection keeps dictionary processing off the UI thread. No word or length change fetches another dictionary section. Dictionary cache and worker bridge tests use Node/mocks; actual browser storage/worker integration still needs a device smoke test.

Not verified here:

- Docker/nginx runtime (neither container engine nor nginx installed)
- Fly account authentication, paid provisioning or live deployment (Fly CLI absent)
- Real browser SDK/CSP integration (Chromium startup blocked by executor socket permissions)
- Real Azure speech calls, billing, listening quality or pronunciation scoring
- Physical phone microphone behavior and installation

No real Azure key or audio was used. Tests use dummy values and mocked provider calls. No repository push, Fly deployment, credential creation, cloud machine, volume or paid resource was performed. The prior Sites deployment is unchanged.

Configuration update: the static hosting app is `russian-practice`, and its primary Fly region is Toronto (`yyz`). Always use `yyz` for Fly deployments. The preparation results above are historical; this configuration correction does not establish a successful live deployment. Static files are public to visitors after publication even if the source repository is private.
