# Dependency risk assessment

Recorded: `2026-07-22T16:21:17+08:00`

## Sharp 0.34.5 advisory

`npm audit --omit=dev` reports two high-severity findings inherited from libvips through `sharp <0.35.0` ([GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)).

Current stable Next and Miniflare releases still require Sharp 0.34.5. Next's support for 0.35.3 exists only after an unreleased/canary change ([vercel/next.js#95507](https://github.com/vercel/next.js/pull/95507)), and Sharp 0.35 contains breaking changes. Forcing an override or accepting `npm audit fix --force` would move this project outside the supported dependency ranges.

## Production reachability

- The built Cloudflare Worker contains no Sharp or libvips import.
- MY SGG accepts no image upload and performs no server-side untrusted image processing.
- Vinext delegates optimization to a configured Cloudflare Images binding or safely redirects to the original same-origin static asset; this project declares no Images binding.
- Miniflare's Sharp path is local development simulation only.
- Production access remains owner-only; this assessment does not authorize public/shared access.

Result: `PASS_WITH_TEMPORARY_NON_REACHABLE_EXCEPTION` for the existing owner-only private deployment. This exception expires before any public/shared release or when an untrusted image-processing path is introduced, whichever comes first.

## Required follow-up

Upgrade to the first stable Next and Cloudflare/Miniflare releases that officially support patched Sharp, then rerun build, tests, and `npm audit --omit=dev`. Do not force Sharp 0.35 into the current unsupported ranges.
