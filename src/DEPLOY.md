# InfinityFree Deployment

Upload the contents of `src/` to the site document root, usually `htdocs/`.

Required paths:

```text
index.html
app.js
styles.css
plan.json
manifest.webmanifest
service-worker.js
api/state.php
api/reset.php
assets/
```

Smoke tests after upload:

```text
https://your-domain/api/state.php
https://your-domain/app.js?v=20260606-sync20
https://your-domain/styles.css?v=20260606-sync20
https://your-domain/manifest.webmanifest
```

`api/state.php` should return:

```json
{"ok":true,"version":1,"room":"fitness-island-v1","updatedAt":0,"users":{}}
```

Reset test server data:

```text
https://your-domain/api/reset.php?token=your-long-random-token
```

For real use, set `FITNESS_ISLAND_RESET_TOKEN` in the PHP environment, or edit `FITNESS_ISLAND_RESET_TOKEN` at the top of `api/reset.php` before uploading. Remove `api/reset.php` after testing if you do not need remote reset. Without a token, reset requests return `500` and will not delete data.

Backend safeguards in `api/state.php`:

```text
max POST body: 256 KB
max users per room: 8
offline cleanup: 14 days
CORS: same-origin by default, or FITNESS_ISLAND_ALLOWED_ORIGIN
```

### Optimistic Concurrency (syncVersion)

`api/state.php` stores one server record per normalized display name and uses a `syncVersion` field on each user record to prevent stale data from overwriting newer data. Same name means the same user; opening the app with the same name on another device will reuse that user record instead of creating a new one.

How it works:

1. Each POST includes the client's current `syncVersion` (starts at 0 for new names).
2. The server compares incoming vs stored version. If `incoming < stored`, the write is **rejected** with HTTP **409 Conflict**.
3. On 409, the client reads the latest server data, restores its own state (`restoreSelfFromServer()`), updates its local `syncVersion`, and retries on next sync cycle.
4. On success, the server increments `syncVersion` by 1 and returns it.

HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Sync accepted, data written |
| 400 | Missing clientId |
| 409 | Stale data rejected — client must pull latest and retry |
| 413 | Request body exceeds 256 KB limit |
| 405 | Method not allowed (only GET/POST) |

Edge cases:

- **First-time name** (no stored record): `$existingUser === null` → skip check → accept.
- **Same name on another device**: writes to the same `userKey`, so it must pass `syncVersion`.
- **Old JS without syncVersion**: sends `undefined` (cast to `0`) → rejected if newer data exists. Old pages cannot overwrite new data; refresh to the latest JS to recover cleanly.
- **After reset.php**: file deleted → no history → fresh start.
- **Page refresh**: `syncVersion` resets to 0 locally → first sync triggers one 409 roundtrip (~100ms), then recovers automatically. No data loss.

If the static page and PHP API are deployed to different domains, set `FITNESS_ISLAND_ALLOWED_ORIGIN` to the page origin. Use `*` only for private testing.

If a phone still shows old UI, open:

```text
https://your-domain/?v=sync20
```

Then refresh once. The app also registers a service worker, so browser site data may need to be cleared after large updates.
