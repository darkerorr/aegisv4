# Aegis brand guidelines

The official reference is `design/logo/a5b5b67b-01f8-4e8e-b9e0-6200fb158b54.png`.
The mark is a three-part protective loop: electric blue, warm orange and cold
white on a blue-black field. The identity should feel like one product across
Web, App and CLI.

## Measured palette

Pixel sampling of the supplied PNG, excluding the near-black background and
grouping colors into 16-step bins, produced these dominant families:

| Role | Extracted range | Product token |
| --- | --- | --- |
| Blue | `#0050C0` to `#00B0FF` | `--aegis-blue`, `--aegis-blue-light` |
| Orange | `#D04000` to `#FF9000` | `--aegis-orange`, `--aegis-orange-light` |
| White | `#C0D0E0` to `#F0F8FF` | `--aegis-white` |
| Background | `#000000` to `#001020` | `--aegis-background` |

The production tokens are in `packages/shared-ui/src/theme/tokens.css` and
are tuned for readable text and accessible controls rather than reproducing
glow pixels literally.

## Usage hierarchy

- blue is the primary interactive and intelligence color;
- orange marks action, agents and important warnings;
- white is reserved for readable content and confirmation;
- blue-black owns the page and application backgrounds;
- red remains reserved for destructive errors and deletions;
- green remains reserved for successful operations and additions.

The primary blue-orange gradient is limited to hero emphasis, primary actions,
loaders and selected states. Content surfaces stay opaque and restrained.

## Logo rules

- use the official PNG where a visual mark is appropriate;
- keep a clear margin around the mark and never crop its loop;
- do not recolor, flatten or rotate the logo;
- do not place it on a bright or noisy background;
- the CLI uses the same color roles through `packages/cli-ui` because a PNG is
  not a reliable terminal asset.

## Motion

The shared loader uses three slow vertical segments: blue, white and orange.
It is available through `AegisLoader` and stops under `prefers-reduced-motion`.
No permanent animation should compete with chat or code output.
