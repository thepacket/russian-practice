# RussianWordPractice

A static, multi-user Russian pronunciation PWA. React + TypeScript in the browser; nginx serves built files on Fly.io. **No application backend, shared user account, server-side Azure key, database or volume.** Each person supplies their own Azure Speech key on their device and contacts Microsoft Azure directly.

Source migrated from the verified Sites source commit `6dd502cb5ff27b9e56770d5954145029c0d21efc`. The existing Sites deployment has not been changed or removed.

## App features

- 41,231 spelling/stress entries, 40,860 distinct spellings, randomized by maximum length (1–32 Cyrillic letters), with no immediate repeat of the same spelling
- English meaning, canonical stress, Wiktionary source links, sourced IPA used for synthesis
- Svetlana/Dmitry Russian neural voices; normal and 20% slower speech
- Up to eight seconds of microphone audio; Validate submits the recording, Next/Cancel discard it
- Conservative Azure pronunciation estimates, not a Russian stress or individual-phoneme diagnosis
- Installable mobile PWA with a dictionary-only local cache; no audio/score cache or offline speech library

## Credentials and privacy

1. Open Settings and enter **your own Azure Speech key for East US**. Never enter a key into a public repository, chat, build variable, Fly secret or deployment command.
2. With Remember unchecked, the key, consent and enabling of Azure calls stay only in browser memory; reloading/closing the app loses them.
3. **Remember my key on this device** (checked by default) stores the key, and whether Azure calls were approved and enabled, in this origin’s browser local storage, so setup is needed once per device. This is not encrypted: app JavaScript, compromised same-origin code, browser extensions or anyone with access to that browser profile may read it. Do not use this on a shared device. Browser/device backups and synchronization are outside the app’s control.
4. The long-lived key goes directly to `https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken` in the subscription-key header. It never goes to Fly or an app API. The SDK receives only the short-lived Azure token, held in memory.
5. Browsers cannot add custom WebSocket authorization headers. Microsoft’s SDK places the short-lived token in the **Azure-only WSS connection URL**, visible in browser developer tools and potentially Azure infrastructure logs. The raw subscription key is not supplied to the SDK or placed in a URL.
6. TTS words and submitted audio go directly to Microsoft’s fixed East US Speech endpoints. SDK telemetry is disabled. The app has no analytics, payload logging, audio storage or score storage. Azure’s own processing, billing and retention policies still apply.
7. Forget key removes the app’s remembered key and approval and clears memory. Rotate the key in Azure for revocation. Requests already submitted can still finish after cancellation.

The app does not limit how many speech requests you make. Use Azure resource quotas and billing controls for account-level protection; provider billing is determined by Azure.

The static website is publicly readable when deployed. A private GitHub repository protects repository access; it does not make delivered HTML, JS or dictionary files private. Client-side Azure authentication controls access to each user’s Azure resource, not access to the website.

## Build and tests

Node 24 is the build/test runtime; production serves static files only.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm start
```

`npm start` runs Vite’s local preview; it is not the production server. Docker uses unprivileged nginx on port 8080. No Python is needed to build, serve or use the app. The optional historical dictionary importer is Python, used only when replacing the source dataset.

- `tests/core.test.mjs`: PCM bounds, scoring, SSML and request limits
- `tests/dictionary.test.mjs`: full dictionary counts, licensing/provenance, stress and selection coverage
- `tests/client.test.mjs`: direct token destination/header, no key storage by default, SDK cleanup, cancellation, local limits and Fly config
- `tests/full-dictionary.test.mjs`: one-download coverage, offline selection, worker cancellation, timeouts, retry, corrupt cache, quota failure and content-version replacement
- `tests/lifecycle.test.mjs`: mocked denied microphone, late permissions/results, Next/Cancel, failed dictionary selection and rapid length changes

## Fly deployment, after account and cost approval

`fly.toml` configures `russian-practice` with one shared-CPU 256MB machine in Toronto (`yyz`). Always use `yyz` for Fly deployments. It explicitly sets:

```toml
auto_stop_machines = "stop"
auto_start_machines = true
min_machines_running = 0
```

There are **no volumes, Fly secrets, keepalive jobs or always-on minimum machines**. Fly health checks assess running machines; do not add an external uptime ping that repeatedly wakes the app. Real traffic can keep a machine running, and stopping after inactivity is managed by Fly rather than instantaneous after each request.

1. Use the official Fly CLI and sign into the intended account yourself. Confirm billing and the selected region’s quote.
2. Use the existing Fly app `russian-practice`; `fly.toml` already names it and pins the primary region to `yyz`.
3. Confirm that the signed-in account can access the existing app with `fly status --app russian-practice`. Do not create a duplicate app.
4. Deploy one machine only: `fly deploy --app russian-practice --region yyz --ha=false`. Do not allocate a dedicated IPv4; shared IPv4/IPv6 is sufficient.
5. If a clearly transient deploy error occurs, retry once. Otherwise retain this source and inspect the error instead of repeated provisioning.
6. Check `fly status`, `fly checks list` and the public HTTPS app URL. Confirm the machine is in `yyz`, is 256MB, there is only one machine and no volume, and it stops after a traffic-free period. Opening the app should wake it again.
7. On the intended phone, test install, key-entry/forget, Say/Say slowly, denied microphone, a short recording, Validate and Next/Cancel. Real Azure speech calls may incur charges and must be initiated by the account owner.
8. Keep the old Sites deployment until this migration is verified. Do not delete it as part of this setup.

The repository contains no deployment credential or GitHub Actions token. The initial preparation did not deploy the app. Subsequent deployment attempts did not complete; a successful live release remains to be verified.

## Hosting estimate

Fly’s [October 1, 2026 pricing update](https://fly.io/pricing-update/) lists the default-region shared-CPU 256MB machine at $0.003/hour, or $2.19 for 730 active hours. Thirty active hours would be about $0.09 of compute. Stopped root filesystem storage is separately $0.15/GB-month; North America/Europe egress is $0.02/GB. Actual region, image size, traffic, taxes and account terms affect the bill. There is no promised free tier or hard monthly cap. Azure Speech usage is separate.

## Dictionary and license

Data and adaptations are CC BY-SA 4.0, attributed to English Wiktionary contributors via Kaikki/Wiktextract. Exact snapshot, input hash, transformations and counts are in `public/dictionary-attribution.json`; each entry links to Wiktionary. The source dump dates to September 2, 2026; extraction October 3, 2026. The UI links the license and offers the adapted JSON download.

All 442,594 source records were considered. Lowercase single-word lemmas with matching English gloss, lexical stress and supported IPA were retained; names, phrases, inflected-only records and unsuitable senses were excluded. This is broad vocabulary, not the whole Russian language or a curated course. Phonetic adaptations have not been listening-validated.

Build generation creates one complete content-hashed gzip archive (1,814,163 bytes; 41,231 entries / 40,860 distinct spellings). The app downloads it once at startup, checks its SHA-256 and counts, decompresses and parses it in a dedicated Web Worker, then saves the verified compressed bytes in a dictionary-only CacheStorage cache. Later page loads use that local copy without a dictionary network request. Browser storage can be cleared or evicted; if storage is denied/full, the current tab still works and the status explains that another visit will need a download. Updating the dictionary changes its content hash and triggers a fresh whole-corpus download.

Next and maximum-letter changes select entirely from the worker's in-memory dictionary, uniformly across eligible entries while excluding all variants of the previous spelling. They do not fetch more sections. Concurrent selections share the startup download; cancelling a selection does not restart it. Progress, validation and storage status remain visible. A stalled download times out after 60 seconds; Next retries. Interrupted or corrupt data is never saved; a corrupt saved copy is replaced. Modern HTTPS browsers with module workers, Web Crypto and DecompressionStream are required.

Only the public dictionary is persisted by this feature. The service worker remains network-only and cannot cache Azure requests, audio, tokens or credentials. The already-open app can select words offline; offline page launch is not promised, and Azure speech needs a connection. Key storage remains separately opt-in and unchanged. The Azure SDK still loads only for a speech request. The adapted JSON is also available as an explicit download.

## Verification boundary

TypeScript, production bundling and automated tests are run without real credentials, microphone audio or billed Azure requests. The fixed Azure token endpoint’s CORS preflight was checked without credentials and returned HTTP 200 with POST and subscription-key headers permitted. Full real-browser/device speech playback, Azure pronunciation quality, Android installation, Docker runtime and a live Fly deployment still require verification. Local Chromium could not start in the preparation executor because its socket sandbox denied process startup; a mocked browser harness was prepared but not claimed as passed.

Official references: [Azure Speech SDK JavaScript](https://github.com/microsoft/cognitive-services-speech-sdk-js), [Azure browser synthesis sample](https://github.com/Azure-Samples/cognitive-services-speech-sdk/blob/master/samples/js/browser/synthesis.html), [Azure token authentication](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech#authentication), [Fly autostop/autostart](https://fly.io/docs/reference/fly-proxy-autostop-autostart/).
