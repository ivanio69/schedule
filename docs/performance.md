# Performance changes — 5.14.0

Measurement baseline: main at 413a9b89534f15e237ba260dbe84ad047c44da9d. The branch also incorporates the subsequent archive-card updates from main at c90d31673de3c71fa75ddb04b59e957fa3d42564.

## Initial assets

Measured from prerendered HTML in production builds of both revisions with Next 16.2.10 / webpack, Node 26.5.0. Google Fonts responses were mocked identically for both builds because external fonts are unavailable in the execution environment. Numbers count each script/stylesheet referenced by initial HTML once; they exclude fonts, API bodies and later route prefetches. Gzip uses Node's default compression, not Vercel's negotiated compression.

| Route | JS before, bytes | JS after, bytes | CSS before, bytes | CSS after, bytes |
| --- | ---: | ---: | ---: | ---: |
| / | 838,762 | 803,713 | 673,243 | 231,486 |
| /schedule | 844,598 | 798,162 | 639,656 | 231,486 |
| /seminars | 742,164 | 742,940 | 601,070 | 173,298 |
| /settings | 816,912 | 818,721 | 601,070 | 173,298 |
| /archive | 762,253 | 755,491 | 673,243 | 231,486 |

Initial CSS decreases 64–71%. Home and schedule JS decrease about 4% and 5%. Small shared runtime additions slightly increase JS on seminars/settings. Home gzip JS+CSS decreases from 351,278 to 298,822 bytes; schedule from 341,871 to 292,648 bytes. These are asset measurements, not measured frame-rate or load-time improvements on a physical device.

Reproduce the current totals after a production build:

```sh
npm run measure:startup
```

## Changes

- Removed the globally imported HeroUI component stylesheet: no application component imports HeroUI. Kept Tailwind and the application's styles. Admin-only styles load with admin/headman routes.
- Removed obsolete schedule wrappers from the page. `IndividualScheduleOverlay` observed the entire document and removed/reinserted its own section on every mutation, including its own writes. Other wrappers independently fetched the schedule, polled the DOM every 300 ms / 1 s, or observed mutations just to infer React's selected date. The schedule already renders individual lessons and the participant picker.
- Scholarship and booked slots now receive the selected date directly. The schedule consumes individual lessons already returned by `/api/schedule`; the dashboard also uses that payload instead of loading all of a person's historical lessons. Initial schedule selection does not request today's payload twice.
- Preserved date/profile cancellation guards and extended them to booked slots and individual lessons. Completed private responses are not cached: simultaneous profile reads share only their pending transport and each consumer gets a separate response body. Auth changes detach old pending reads.
- Editors and event details load on opening. Task rows skip parent dashboard renders when their props are unchanged; layout measurements depend on actual task data. Seminars avoid replacing unchanged payloads during polling.
- Preserved all 32 snowflakes, duration, negative delays and drift paths using browser CSS transform keyframes. Background-to-five-dot morph reads all five current transforms before writing styles. Sticky-header measurements read geometry before style writes. Full-route layer promotion is no longer permanent.
- Dashboard/schedule clocks share a minute timer; detail timers share a second or 30-second timer. Clocks align to time boundaries, stop while hidden and catch up immediately on return. Removed the five-second permission poll; diagnostics pause network refreshes while hidden. Analytics no longer writes session storage on every scroll event. Identical appearance syncs no longer restart global colour transitions.

## Validation and limits

- Production webpack build and TypeScript check pass; PWA build/cache tests pass.
- `npm run test:performance` exercises shared request bodies, failures/retries, auth changes, clock teardown/pause/resume, stale date responses, initial request deduplication, and task entrance visibility/fallbacks.
- Other task, personal-event, rehearsal-visibility, dashboard-timeline, schedule-change, digest, dev-environment and changelog tests pass.
- The full `.test.mjs` set has one existing failure in `tests/admin-design.test.mjs` (client page spacing rule), reproduced unchanged on the base revision. ESLint has existing repository errors; comparison with the base found no additional diagnostics.
- Local browser smoke testing is blocked because this environment denies listening on a local TCP port. Native iOS/weak-device frame rates, live database latency and authenticated preview interactions need a browser/device check; no performance score is claimed for them.
