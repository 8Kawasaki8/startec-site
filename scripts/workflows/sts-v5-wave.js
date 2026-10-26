export const meta = {
  name: 'sts-v5-wave',
  description: 'Execute one wave of v5 work packages: build (disjoint batches) -> adversarial review -> fix -> headless QA',
  phases: [
    { title: 'Build', detail: 'one builder per work package, batches of disjoint files' },
    { title: 'Review', detail: 'honesty, performance/mobile, craft reviewers on the wave diff' },
    { title: 'Fix', detail: 'apply confirmed findings' },
    { title: 'QA', detail: 'build.py + node scripts/qa/qa.mjs, desktop + phone, fix loop' },
  ],
}

// args: { context: string, packageIds: ['WP-00',...], depsOverride?: {id: []}, wave: string, extraReviewFocus?: string }
// Work packages are loaded from scripts/workflows/plan-v5.json by a loader agent (scripts have no fs access).
const { context, packageIds, depsOverride = {}, wave, extraReviewFocus = '' } = args
const PKGS = { type: 'object', properties: { packages: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, scope: { type: 'string' }, files: { type: 'string' }, acceptance: { type: 'string' }, qa: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } } }, required: ['id', 'title', 'scope', 'files', 'acceptance', 'qa', 'dependsOn'] } } }, required: ['packages'] }
const loaded = await agent(`Read /home/user/startec-site/scripts/workflows/plan-v5.json and return the workPackages whose id is in ${JSON.stringify(packageIds)}, verbatim (full scope, files, acceptance, qa, dependsOn), in the order given.`, { label: 'load-packages', schema: PKGS, effort: 'low' })
const packages = loaded.packages.map(p => ({ ...p, dependsOn: depsOverride[p.id] || p.dependsOn }))
const RULES = `
REPO: /home/user/startec-site (static site; src/pages/*.html + src/partials -> python3 scripts/build.py --base "https://8kawasaki8.github.io/startec-site/" -> docs/). Edit sources in src/ and assets in docs/assets; never hand-edit generated docs/*.html that have a src/pages counterpart. QA gate: node scripts/qa/qa.mjs (serves docs/, desktop 1440x900 + phone 390x844 + reduced motion; zero console errors, zero external requests, no horizontal overflow, nl lang, one h1, no emoji, no euro amounts on STS pages). Run it with --pages a.html,b.html for a subset while iterating, full at the end.
HARD RULES: Dutch nl-BE copy (Belgium/Antwerpen, no Netherlands); no prices; no emojis; no fake reviews/counters/urgency/'verzonden' states; every simulation labelled gesimuleerd/fictief when data is invented; the human-approval promise is real and stays; cyan #36E8FF accent only; keep legal pages and docs/assets/js/config.js config-driven data; comet-S logo; fonts Panchang/Switzer/JetBrains Mono self-hosted; NO external requests (no CDNs, fonts, analytics, iframes to other hosts); static only; weak-GPU rules: never animate filter/blur/box-shadow/background-position on large layers, no full-page mix-blend-mode, pause rAF loops when tab hidden or element offscreen, DPR cap 1.5, keep lite mode and prefers-reduced-motion paths; every file under 500 lines (split modules); keyboard reachable and focus-visible; touch targets >= 44px on phone.
WORKING STYLE: commit nothing; do not run git commands that change state (no checkout/reset/stash); other agents may be editing OTHER files in the same tree concurrently, so touch only the files listed for your package plus new files you create; if you must change a shared file (style.css, partials, config.js), make minimal, append-only additions in a clearly commented block. Return facts, not marketing.`

const BUILD = { type: 'object', properties: { done: { type: 'boolean' }, filesChanged: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' }, acceptanceEvidence: { type: 'string' }, blockers: { type: 'array', items: { type: 'string' } } }, required: ['done', 'filesChanged', 'summary', 'acceptanceEvidence', 'blockers'] }
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'file', 'issue', 'fix'] } }, verdict: { type: 'string' } }, required: ['findings', 'verdict'] }
const VERDICT = { type: 'object', properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } }, required: ['refuted', 'reason'] }
const FIX = { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, filesChanged: { type: 'array', items: { type: 'string' } } }, required: ['fixed', 'skipped', 'filesChanged'] }
const QA = { type: 'object', properties: { passed: { type: 'boolean' }, summary: { type: 'string' }, remaining: { type: 'array', items: { type: 'string' } }, filesChanged: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'summary', 'remaining', 'filesChanged'] }

function fileSet(p) { return new Set(String(p.files || '').split(/[\s,;]+/).map(f => f.trim().toLowerCase()).filter(f => f && !f.startsWith('(') && f.includes('.'))) }
function overlaps(a, b) { for (const f of a) if (b.has(f)) return true; return false }
// batches: packages whose dependencies are satisfied and whose files are disjoint from others in the batch
const remaining = packages.slice()
const doneIds = new Set()
const batches = []
while (remaining.length) {
  const ready = remaining.filter(p => (p.dependsOn || []).every(d => doneIds.has(d) || !packages.some(x => x.id === d)))
  const pick = ready.length ? ready : [remaining[0]]
  const batch = []
  const used = []
  for (const p of pick) { const fs = fileSet(p); if (!used.some(u => overlaps(u, fs))) { batch.push(p); used.push(fs) } }
  for (const p of batch) { remaining.splice(remaining.indexOf(p), 1); doneIds.add(p.id) }
  batches.push(batch)
}
log(`wave ${wave}: ${packages.length} packages in ${batches.length} batch(es): ${batches.map(b => b.map(p => p.id).join('+')).join(' -> ')}`)

phase('Build')
const builds = []
for (const batch of batches) {
  const res = await parallel(batch.map(p => () => agent(`${context}
${RULES}
WORK PACKAGE ${p.id}: ${p.title}
SCOPE: ${p.scope}
FILES: ${p.files}
ACCEPTANCE: ${p.acceptance}
QA HINTS: ${p.qa || ''}
TASK: Implement this work package completely in the repo. First read the files you will touch and the relevant existing modules so you match conventions (tokens in docs/assets/css/style.css, partials, config.js, build.py). Write production-quality code and Dutch copy; no placeholders, no TODOs, no lorem ipsum. After implementing: run python3 scripts/build.py --base "https://8kawasaki8.github.io/startec-site/" and node scripts/qa/qa.mjs --pages <the pages you touched> and fix what it reports. Check line counts (wc -l) and split anything over 500 lines. Then verify each acceptance criterion yourself (Playwright snippets with node -e are fine) and report evidence.`, { phase: 'Build', label: `build:${p.id}`, schema: BUILD, effort: 'high' })))
  builds.push(...res.map((r, i) => ({ pkg: batch[i].id, result: r })))
  log(`batch done: ${batch.map((p, i) => `${p.id}=${res[i]?.done ? 'ok' : 'INCOMPLETE'}`).join(', ')}`)
}
const blockers = builds.flatMap(b => (b.result?.blockers || []).map(x => `${b.pkg}: ${x}`))
if (blockers.length) log(`blockers: ${blockers.join(' | ')}`)

phase('Review')
const changed = [...new Set(builds.flatMap(b => b.result?.filesChanged || []))]
const summary = builds.map(b => `${b.pkg}: ${b.result?.summary || 'no result'}`).join('\n')
const LENSES = [
  { key: 'honesty', focus: 'HONESTY and COPY: every claim must be true for a one-person studio with the stated capabilities; no prices, no emojis, no fake social proof/urgency/sent states; simulations labelled gesimuleerd/fictief; nl-BE Dutch quality (spelling, tone trust-first, no Netherlands-isms like "jij/jou" overuse is fine but avoid "u" vs "je" inconsistency within a page); the human-approval promise intact; legal pages intact.' },
  { key: 'perf-mobile', focus: 'PERFORMANCE and MOBILE: weak-GPU rules (no animated filter/blur/box-shadow/background-position on big layers, no full-page mix-blend-mode, rAF loops paused when hidden/offscreen, DPR <= 1.5), lite mode and prefers-reduced-motion paths, 390px layout, touch targets, no horizontal overflow, no layout shift from fonts, no external requests, file sizes (no asset > 300 KB added), files under 500 lines.' },
  { key: 'craft', focus: 'CRAFT and CORRECTNESS: does the work meet the acceptance criteria literally; broken links/anchors; JS errors in edge cases (empty input, long names, repeated clicks, back navigation); keyboard and focus-visible; a11y labels; consistency with the design system (tokens, Panchang/Switzer/JetBrains Mono, cyan accent only); build.py conventions (src -> docs); dead code; anything generic or AI-slop looking.' },
]
const reviews = (await parallel(LENSES.map(l => () => agent(`${context}
${RULES}
WAVE ${wave} CHANGES (files): ${changed.join(', ')}
BUILDER SUMMARIES:
${summary}
WORK PACKAGES: ${JSON.stringify(packages.map(p => ({ id: p.id, title: p.title, acceptance: p.acceptance })))}
TASK: Adversarial review through this lens: ${l.focus} ${extraReviewFocus}
Read the changed files fully (git diff and the files themselves), run the site headlessly if needed (python3 -m http.server in docs/ + Playwright via node -e). Report only concrete, verifiable findings with file and a precise fix. Do NOT edit files.`, { phase: 'Review', label: `review:${l.key}`, schema: FINDINGS, effort: 'high' })))).filter(Boolean)
const all = reviews.flatMap(r => r.findings)
log(`review: ${all.length} findings (${all.filter(f => f.severity === 'critical').length} critical, ${all.filter(f => f.severity === 'major').length} major)`)

// adversarial verify on critical/major: 2 skeptics each, keep unless both refute
const serious = all.filter(f => f.severity !== 'minor')
const verified = await parallel(serious.map(f => () => parallel([0, 1].map(i => () => agent(`${RULES}
FINDING: ${JSON.stringify(f)}
TASK (skeptic ${i + 1}): Try to REFUTE this review finding by reading the actual file(s) in /home/user/startec-site. refuted=true only if the finding is factually wrong or already handled; if it is real, refuted=false.`, { phase: 'Review', label: `verify:${f.file.split('/').pop()}:${i}`, schema: VERDICT, effort: 'medium' }))).then(vs => ({ f, keep: vs.filter(Boolean).filter(v => v.refuted).length < 2 }))))
const confirmed = verified.filter(Boolean).filter(v => v.keep).map(v => v.f)
const minors = all.filter(f => f.severity === 'minor')
log(`confirmed: ${confirmed.length} serious + ${minors.length} minor`)

phase('Fix')
const fix = await agent(`${context}
${RULES}
CONFIRMED FINDINGS (must fix): ${JSON.stringify(confirmed)}
MINOR FINDINGS (fix when cheap): ${JSON.stringify(minors)}
TASK: Apply the fixes in the repo. Keep acceptance criteria of the work packages intact: ${JSON.stringify(packages.map(p => ({ id: p.id, acceptance: p.acceptance })))}. After fixing run python3 scripts/build.py --base "https://8kawasaki8.github.io/startec-site/" then node scripts/qa/qa.mjs (full). Report what you fixed and what you skipped with reason.`, { phase: 'Fix', label: 'fix', schema: FIX, effort: 'high' })

phase('QA')
let qa = null
for (let round = 0; round < 3; round++) {
  qa = await agent(`${RULES}
TASK: Final QA for wave ${wave}. Run: python3 scripts/build.py --base "https://8kawasaki8.github.io/startec-site/" && node scripts/qa/qa.mjs . Then open the key pages yourself with Playwright (node -e) at 1440x900 and 390x844 and look at the screenshots in .qa/ (Read the png files) for visual breakage: overlapping text, unreadable contrast, clipped elements, empty sections, broken layout on phone. Also test keyboard: Tab through index.html and confirm focus is visible and all interactive elements reachable. Also check the acceptance criteria once more: ${JSON.stringify(packages.map(p => ({ id: p.id, acceptance: p.acceptance })))}. Fix any problem you find directly (small, surgical fixes), rebuild, rerun qa.mjs until it passes. Report passed=true only if qa.mjs exits 0 and you saw no visual breakage.`, { phase: 'QA', label: `qa:round${round + 1}`, schema: QA, effort: 'high' })
  if (qa?.passed) break
  log(`qa round ${round + 1} not passed: ${(qa?.remaining || []).join(' | ')}`)
}
return { wave, builds, blockers, findings: { confirmed, minors, refuted: verified.filter(v => v && !v.keep).map(v => v.f) }, fix, qa }
