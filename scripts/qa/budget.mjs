// Budgets, gates and the list of known violations of the current site.
// classify() turns a raw issue into 'fail', 'known' (named WP fixes it) or 'notice'.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Measured-then-enforced budgets. budget.json (WP-15) overrides these values and flips gates on. */
export const DEFAULT_BUDGET = {
  rafIdleMax: 0,              // rAF callbacks during 3 s idle (desktop/tablet); phone must have no loop at all
  activeIntervalsMax: 0,      // setInterval without clearInterval after idle
  pendingTimeoutsMax: 2,      // setTimeout still pending after 3 s idle
  phoneRawBytesMax: 450_000,  // phone first load, raw bytes, without Three.js
  jsGzipLiteMax: 90_000,      // JS per page, gzip-equivalent, in the lite route
  sceneEventMs: 6000,         // sts:scene-ready or sts:scene-failed must fire within this
  firstViewportWords: { 'index.html': ['onderzoek', 'verkenner', 'Snymis'] },
  // Gates start off: the numbers are reported and listed as 'known' until the WP that makes them true lands.
  gates: { rafIdle: false, timers: false, bytes: false, firstViewport: false, backdropFilter: false, lineLimitsStrict: false },
};

export function loadBudget(root = process.cwd()) {
  const file = join(root, 'scripts', 'qa', 'budget.json');
  if (!existsSync(file)) return { ...DEFAULT_BUDGET, source: 'standaardwaarden (budget.json komt met WP-15)' };
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return { ...DEFAULT_BUDGET, ...data, gates: { ...DEFAULT_BUDGET.gates, ...(data.gates || {}) }, source: 'scripts/qa/budget.json' };
}

/**
 * Known violations of the site as committed today. Each names the work package that removes it.
 * `when(issue, ctx)` decides whether an issue is this known case. Keep entries specific:
 * the broken fixture and new work must still fail. WP-04 removed its own entries (style.css split,
 * backdrop-filter, the motion.js rAF loop, timers, index bytes, 'Data & leads', first viewport,
 * index overflow), WP-02 (the conversion check without STSBericht) and WP-11 ('jullie' in the FAQ
 * question, now <details><summary>) theirs: those checks fail for real from now on.
 */
export const KNOWN = [
  { wp: 'WP-09', note: 'de oude demos.html weegt op de telefoon ~778 kB (afbeeldingen 495 kB); ze wordt een redirect-stub naar werkwijze.html#straat',
    when: (i) => i.check === 'bytes' && i.page === 'demos.html' },
  { wp: 'WP-15', note: 'strengere regellimieten (scene < 300, CSS < 400) worden pas bij de eindaudit afgedwongen',
    when: (i) => i.check === 'lines-strict' },
];

/**
 * Decides the severity of an issue.
 * ctx: { root, budget, page }. Gates that are on turn the matching known cases back into failures.
 */
export function classify(issue, ctx) {
  const g = ctx.budget.gates;
  const gated = (issue.check === 'raf' && g.rafIdle) || (issue.check === 'timer' && g.timers) || (issue.check === 'bytes' && g.bytes)
    || (issue.check === 'first-viewport' && g.firstViewport) || (issue.check === 'backdrop-filter' && g.backdropFilter)
    || (issue.check === 'lines-strict' && g.lineLimitsStrict);
  if (issue.severity === 'notice') return { ...issue, severity: 'notice' };
  if (!gated) {
    for (const k of KNOWN) {
      let hit = false;
      try { hit = k.when(issue, ctx); } catch { hit = false; }
      if (hit) return { ...issue, severity: 'known', wp: k.wp, note: k.note };
    }
  }
  return { ...issue, severity: 'fail' };
}

/** Evaluates the measured numbers of one run against the budget; returns raw issues. */
export function budgetIssues(run, budget) {
  const out = [];
  const demo = /^demo\//.test(run.page);
  if (!demo) {
    if (run.rafCount > budget.rafIdleMax) out.push({ check: 'raf', text: `rAF draait nog: ${run.rafCount} callbacks in 3 s rust (budget ${budget.rafIdleMax})` });
    if (run.timerCount && run.timerCount.intervalsActive > budget.activeIntervalsMax) out.push({ check: 'timer', text: `${run.timerCount.intervalsActive} setInterval zonder clearInterval na rust` });
    if (run.timerCount && run.timerCount.timeoutsPending > budget.pendingTimeoutsMax) out.push({ check: 'timer', text: `${run.timerCount.timeoutsPending} setTimeout nog hangend 3 s na rust (budget ${budget.pendingTimeoutsMax})` });
    if (run.profile === 'phone' && run.bytes && run.bytes.total > budget.phoneRawBytesMax) out.push({ check: 'bytes', text: `telefoon laadt ${Math.round(run.bytes.total / 1024)} kB ruw (budget ${Math.round(budget.phoneRawBytesMax / 1024)} kB)` });
    if (run.variant === 'lite' && run.bytes && run.bytes.jsGzip > budget.jsGzipLiteMax) out.push({ check: 'bytes', text: `lite laadt ${Math.round(run.bytes.jsGzip / 1024)} kB JS (gzip-equivalent, budget ${Math.round(budget.jsGzipLiteMax / 1024)} kB)` });
  }
  if (run.scene && run.scene.hasCanvas && run.mode !== 'nogl' && run.scene.event === 'none') out.push({ check: 'scene', text: `geen sts:scene-ready of sts:scene-failed binnen ${budget.sceneEventMs} ms` });
  if (run.scene && run.scene.hasCanvas && run.mode === 'nogl' && !run.scene.fallbackVisible) out.push({ check: 'scene', text: '#scene-fallback blijft verborgen zonder WebGL' });
  if (run.mode !== 'nogl' && run.webgl && run.webgl.available === false && run.page === 'index.html') out.push({ check: 'webgl', text: `WebGL2 ontbreekt in modus ${run.mode}` });
  return out;
}

/** Summarises a classified issue list into a run status. */
export function statusOf(issues) {
  if (issues.some(i => i.severity === 'fail')) return 'fail';
  if (issues.some(i => i.severity === 'known')) return 'known';
  return 'pass';
}
