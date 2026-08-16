# Production asset validation report

## Result

Production asset validation passed. No CSS or JavaScript asset extracted from the required routes returned 404, `text/plain`, or `text/html`.

## Production build

- Next.js: 15.5.20.
- Static generation: 58/58 pages.
- `/github`: compiled as a workspace route, 3.74 kB route payload and 121 kB first-load JS in the validated build.
- `StatePanel` supports the real loading state with `LoaderCircle`, `animate-spin`, `role="status"`, and `aria-live="polite"`.

## HTTP/MIME matrix

| Route | Route status | CSS | JavaScript |
|---|---:|---:|---:|
| `/` | 200 | 2/2 HTTP 200 `text/css` | 22/22 HTTP 200 `application/javascript` |
| `/chat` | 200 | 2/2 | 26/26 |
| `/connections` | 200 | 2/2 | 24/24 |
| `/github` | 200 | 2/2 | 24/24 |
| `/account` | 200 | 2/2 | 24/24 |
| `/projects` | 200 | 2/2 | 24/24 |
| `/workspace/models` | 200 | 2/2 | 24/24 |

There were 39 unique extracted assets. The direct `/github` chunk, workspace layout chunk, shared chunk 3544, both CSS files and all shared runtime chunks returned HTTP 200 with valid MIME types.

## Browser automation

`production-assets.spec.ts` verified:

- direct address-bar equivalent navigation to `/github`;
- React hydration and the workspace heading;
- stylesheet and Next script presence;
- no `ChunkLoadError` or `Loading chunk` page error;
- no failed `/_next/static/` response;
- full reload;
- styled error fallback with `Unable to check GitHub connection.` and `Retry`.

Both production-asset scenarios passed in Chromium. The full Chromium run passed 36/36 scenarios in 1.4 minutes.

## Manual browser status

The integrated interactive browser exposed no controllable tab in this session. Private-window and visually inspected interactive scenarios are therefore not claimed. HTTP production validation and Chromium automation passed.