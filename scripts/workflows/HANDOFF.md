# HANDOFF: continuing the STS v5 build on any machine

Last updated by the cloud session on 2026-10-26 (wave 4 live; wave 5 running).
This file is updated at every wave boundary. If the cloud session stopped (credits refused,
container reclaimed), everything below still holds: **only complete, QA-green waves are ever
pushed**, builders never commit, so the remote is always consistent.

## State of the branches

| branch | meaning |
| --- | --- |
| `main` | the LIVE site (GitHub Pages serves `/docs` from here). Only receives fast-forward merges from `v5` after a full green QA matrix. |
| `v5` | the working branch. At each release it is identical to `main`; between releases it may be ahead by committed, QA-green waves. |

If `v5` is ahead of `main`, that work passed QA but was not yet released. Releasing it is
`git checkout main && git merge --ff-only v5 && STS_RELEASE=1 git push origin main`.

A wave that was interrupted leaves **nothing** on the remote. Rerun it (see "Continuing the waves").

## Continue on the laptop (Windows, PowerShell or Git Bash)

```sh
cd C:/Users/Moham/OneDrive/SakiPortofolio/startec-site
git fetch origin
git checkout main && git pull --ff-only origin main
git checkout v5   && git pull --ff-only origin v5
npm ci
npx playwright install chromium
python scripts/build.py --base https://8kawasaki8.github.io/startec-site/
npm run qa:quick       # about 1 minute
npm run qa             # full matrix, 10 to 17 minutes
```

Notes for Windows: `package.json` scripts call `python3`; if only `python` exists, run the
build command above directly or add `python3` as an alias. `scripts/qa/qa.mjs` starts its own
`python3 -m http.server`; set `PYTHON=python` is not supported, so make sure `python3` resolves
(the Microsoft Store alias or a `python3.exe` copy next to `python.exe` works).
Everything else (node 20+, Playwright 1.63 pinned, Chromium) is the same as in the cloud.

## Where things are

- `scripts/workflows/PLAN-V5.md`: the strategy result and build plan, with a Wave-log of decisions at the end.
- `scripts/workflows/plan-v5.json`: the same plan as data, including the polish packages WP-16 to WP-22. The wave workflow loads packages from here by id.
- `scripts/workflows/research-v5.json`: site audit, capability inventory, Flemish buyer psychology, inspiration (used by the copy pass).
- `scripts/workflows/sts-v5-strategy.js`: the strategy workflow (done, do not rerun).
- `scripts/workflows/sts-v5-wave.js`: the build-wave workflow (build in disjoint batches, three adversarial reviewers, skeptic verification, fix, QA loop).
- `scripts/qa/README.md`: the QA harness. `copy-regels.md` and `src/data/woordenlijst.json`: the copy rules lint-copy enforces.
- `docs/CHECKLIST-SAKI.md`: what Saki still has to supply or decide (KBO, address, e-mail, domain, photo, story, sfeerzinnen, legal wording OKs).
- `README.md`: Kamercontract (rooms), scene profile table.

## Wave status

| wave | packages | status |
| --- | --- | --- |
| 1 | WP-00 QA harness, WP-01 build system, WP-02 state core, WP-03 scene | done, pushed |
| 2 | WP-04 front and strip, WP-05 gevel, WP-06 telefoon, WP-07 doorlichting, WP-08 gereedschap, WP-11 bericht | done, LIVE |
| 3 | WP-09 werkwijze, WP-13 wijk pages, WP-14 openingsuren, WP-10 sketches, WP-12 copy pass | done, LIVE |
| 4 | WP-15 release audit, WP-16 performance, WP-19 accessibility, WP-21 scene craft | done, LIVE |
| 5 | WP-17 mobile UX, WP-18 copy and emotion | running in the cloud when this file was written |
| 6 | WP-22 release refresh | planned |

Check `git log origin/v5 --oneline` to see which waves actually landed; a wave's commit message
starts with `v5 wave N`.

## Continuing the waves with Claude Code (local or cloud)

Ultracode on. In a Claude Code session with the repo open, run:

```
Workflow({ scriptPath: "scripts/workflows/sts-v5-wave.js", args: {
  wave: "5", packageIds: ["WP-17", "WP-18"],
  context: "<the context paragraph: see the last wave's args in the session, or paste PLAN-V5.md 'Gekozen concept' + ground truth + the list of what exists>",
  extraReviewFocus: "<wave-specific review points>" } })
```

After the workflow returns: `npm run qa` must print `QA GROEN`; then commit on `v5`
(message `v5 wave N: ...`, ending with the Co-Authored-By line), push `v5`, run the full
`npm run qa` once more on the committed tree, commit `docs/qa-report.html`, fast-forward
`main` and push with `STS_RELEASE=1`.

Without the Workflow tool, the same work can be done by hand: read the package in
`plan-v5.json`, implement it, run `npm run qa`, review against the Eerlijkheidsregels and
Performanceregels in PLAN-V5.md, fix, QA again, commit.

## Hard rules (unchanged)

Dutch nl-BE; no prices; no emojis; no fake reviews, counters, urgency or 'verzonden' states;
simulations labelled gesimuleerd/fictief; the human-approval promise is real; cyan #36E8FF accent
only; legal pages config-driven; comet-S logo; fonts Panchang/Switzer/JetBrains Mono self-hosted;
no external requests; static only; weak-GPU rules; files under 500 lines.
