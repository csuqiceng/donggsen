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
https://your-domain/app.js?v=20260606-sync8
https://your-domain/styles.css?v=20260606-sync8
https://your-domain/manifest.webmanifest
```

`api/state.php` should return:

```json
{"ok":true,"version":1,"room":"fitness-island-v1","updatedAt":0,"users":{}}
```

Reset test server data:

```text
https://your-domain/api/reset.php?token=reset-fitness-island
```

For real use, change the reset token by setting `FITNESS_ISLAND_RESET_TOKEN` in the PHP environment, or remove `api/reset.php` after testing.

Backend safeguards in `api/state.php`:

```text
max POST body: 256 KB
max users per room: 8
offline cleanup: 14 days
CORS: same-origin by default, or FITNESS_ISLAND_ALLOWED_ORIGIN
```

If the static page and PHP API are deployed to different domains, set `FITNESS_ISLAND_ALLOWED_ORIGIN` to the page origin. Use `*` only for private testing.

If a phone still shows old UI, open:

```text
https://your-domain/?v=sync8
```

Then refresh once. The app also registers a service worker, so browser site data may need to be cleared after large updates.
