# Home Hero Candidate QA

- Reviewed: 2026-07-23T19:51:05+08:00
- Reviewer: Codex Image 2.0 visual QA
- Runtime/public integration: not performed
- Approval state: `CANDIDATE`
- Desktop review: complete 16:9 source at 1672 × 941
- Mobile review: approximate 390 × 630 `object-fit: cover` crop using the
  current `object-position: 60%`

## Result

| # | Canonical pair | OTOMO form | Desktop copy zone | Both identities in mobile crop | Exactly two characters | No standalone text / watermark | Family-safe framing | Result |
|---|---|---|---|---|---|---|---|---|
| 01 | Ebisu × Taimaru | DOJI | PASS | PASS | PASS | PASS | PASS | PASS |
| 02 | Taiyo × Kozuchi | INCARNATE | PASS | PASS | PASS | PASS | PASS | PASS |
| 03 | Sobi × Momokatsu | SPIRIT | PASS | PASS | PASS | PASS | PASS | PASS |
| 04 | Saika × Kotone | DOJI | PASS | PASS | PASS | PASS | PASS | PASS |
| 05 | Juraku × Juka | INCARNATE | PASS | PASS | PASS | PASS | PASS | PASS |
| 06 | Fukuei × Haku | SPIRIT | PASS | PASS | PASS | PASS | PASS | PASS |
| 07 | Shouren × Shofuku | DOJI | PASS | PASS | PASS | PASS | PASS | PASS |
| 08 | Ebisu × Taimaru | SPIRIT | PASS | PASS | PASS | PASS | PASS | PASS |
| 09 | Saika × Kotone | INCARNATE | PASS | PASS | PASS | PASS | PASS | PASS |
| 10 | Sobi × Momokatsu | DOJI | PASS | PASS | PASS | PASS | PASS | PASS |

The mobile criterion is identity readability: both GOD and OTOMO face/form are
visible together above the strongest part of the copy gradient. Some lower
platform detail is intentionally available for the overlay to darken.

## Form balance

- SPIRIT: 3
- INCARNATE: 3
- DOJI: 4
- Maximum difference: 1
- Result: PASS

## Rejected iterations

- The first ten desktop concepts were rejected for responsive use because the
  current mobile crop removed all or most of the OTOMO in several scenes.
- Early versions of 06 and 07 were separately rejected because the pose and
  torso treatment were too sexualized for a family-facing Home entry point.
- Rejection reasons remain under `rejected/`; the binary Image 2.0 iterations
  remain in the Codex generated-image store and were not duplicated into the
  repository.

## Review artifacts

- `CONTACT_SHEET.png`: desktop overview
- `MOBILE_CROP_CONTACT_SHEET.png`: simulated current mobile crop
- `OTOMO_FORM_PLAN.csv`: candidate form inventory
- `PRODUCTION_RECORD.json`: generation, references, rights, hashes, and outputs
