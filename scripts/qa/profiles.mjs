// Profiles, GL modes, variants and the pruned test matrix for the QA harness.
// Everything that decides WHAT runs lives here; qa.mjs only executes it.

/** The GitHub Pages origin the site is built for. 404.html carries a <base> to it,
 *  so the harness maps requests to this host back onto the local server. */
export const PAGES_BASE = 'https://8kawasaki8.github.io/startec-site/';
export const PAGES_HOST = new URL(PAGES_BASE).hostname;
export const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** Storage keys the site may use (cookies.html and privacy 2.3 promise exactly these). */
export const STORAGE_ALLOW = { session: ['sts-pre', 'sts-zaak'], local: ['sts-lite'] };

/** Pages that are not STS voice: fictional demo sites and the Radar concept. */
export const isDemoPage = (page) => page.startsWith('demo/');
/** Legal pages: 'euro' is allowed there (voorwaarden names the legal 40 euro fee). */
export const LEGAL_PAGES = new Set(['juridisch.html', 'privacy.html', 'cookies.html', 'voorwaarden.html']);
export const isLegalPage = (page) => LEGAL_PAGES.has(page);

/** Three ways to launch Chromium, named for what they are. */
export const GL_MODES = {
  // Headless default: ANGLE on SwiftShader. Without the flag Chromium 1xx refuses WebGL in headless.
  gl: { args: ['--enable-unsafe-swiftshader'], label: 'gl (headless ANGLE/SwiftShader)' },
  // Explicit software GL, the slowest but most deterministic path.
  'gl-swift': { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], label: 'gl-swift (expliciet SwiftShader)' },
  // No WebGL at all: the site must show #scene-fallback and stay usable.
  nogl: { args: ['--disable-3d-apis'], label: 'nogl (geen WebGL)' },
};

/** Device profiles. hardwareConcurrency is injected by an init script (Playwright has no option for it). */
export const PROFILES = {
  phone: {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    hardwareConcurrency: 4, pointer: 'coarse',
  },
  desktop: {
    viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1,
    hardwareConcurrency: 8, pointer: 'fine',
  },
  tablet: {
    viewport: { width: 1024, height: 1366 }, isMobile: false, hasTouch: true, deviceScaleFactor: 2,
    hardwareConcurrency: 8, pointer: 'coarse',
  },
};

/** Variants: default, prefers-reduced-motion, the ?lite route, and 'intro' (sessionStorage sts-pre absent,
 *  so the intro plays: GSAP timeline on the GL route, the lift on the SVG route). */
export const VARIANTS = {
  default: { reducedMotion: 'no-preference', query: '' },
  reduced: { reducedMotion: 'reduce', query: '' },
  lite: { reducedMotion: 'no-preference', query: '?lite' },
  intro: { reducedMotion: 'no-preference', query: '', intro: true },
};
/** Pages x profiles on which the intro variant runs. */
export const INTRO_RUNS = { pages: ['index.html'], profiles: ['desktop', 'phone'] };
/** The intro budget: sts:intro-done at most this long after the first scene event. */
export const INTRO_MAX_MS = 1600;

/** Pages that also run in gl-swift and nogl (the scene pages plus one wijk page). */
export function scenePages(pages) {
  const wijk = pages.filter(p => p.startsWith('wijk/')).sort()[0];
  return ['index.html', 'dev/scene.html', 'simulatie.html', wijk].filter(Boolean);
}

/** Pages where the ?lite variant matters: everything that loads the scene module. */
export function litePages(pages) {
  return pages.filter(p => ['index.html', 'dev/scene.html', 'simulatie.html'].includes(p) || p.startsWith('wijk/'));
}

/** Builds the pruned run list. `pages` are paths relative to docs/. */
export function buildMatrix(pages, { quick = false, modes = null, profiles = null, all = null } = {}) {
  const runs = [];
  const notices = [];
  const site = all || pages;            // notices look at the whole site, runs only at the selection
  const scenes = scenePages(site).filter(p => pages.includes(p));
  const add = (page, profile, mode, variant) => runs.push({ page, profile, mode, variant });
  const wantMode = (m) => !modes || modes.includes(m);
  const wantProfile = (p) => !profiles || profiles.includes(p);

  const addIntro = () => {
    for (const page of INTRO_RUNS.pages) if (pages.includes(page)) for (const profile of INTRO_RUNS.profiles) if (wantProfile(profile) && wantMode('gl')) add(page, profile, 'gl', 'intro');
  };
  if (quick) {
    for (const page of ['index.html', 'dev/scene.html']) {
      if (!pages.includes(page)) { notices.push(`${page} ontbreekt nog, overgeslagen in qa:quick`); continue; }
      for (const profile of ['desktop', 'phone']) if (wantProfile(profile) && wantMode('gl')) add(page, profile, 'gl', 'default');
    }
    addIntro();
    return { runs, notices };
  }

  for (const page of pages) {
    for (const profile of Object.keys(PROFILES)) {
      if (!wantProfile(profile) || !wantMode('gl')) continue;
      add(page, profile, 'gl', 'default');
      // reduced motion: phone for every page, desktop too on the scene pages
      if (profile === 'phone' || (profile === 'desktop' && scenes.includes(page))) add(page, profile, 'gl', 'reduced');
    }
  }
  for (const page of litePages(pages)) {
    for (const profile of ['desktop', 'phone']) if (wantProfile(profile) && wantMode('gl')) add(page, profile, 'gl', 'lite');
  }
  addIntro();
  for (const page of ['index.html', 'dev/scene.html', 'simulatie.html']) {
    if (!site.includes(page)) notices.push(`${page} ontbreekt nog; gl-swift en nogl draaien er pas op zodra de pagina bestaat`);
  }
  if (!site.some(p => p.startsWith('wijk/'))) notices.push('geen wijk/*.html gevonden (WP-13); gl-swift en nogl slaan de wijkpagina over');
  for (const page of scenes) {
    for (const mode of ['gl-swift', 'nogl']) {
      if (!wantMode(mode)) continue;
      for (const profile of ['desktop', 'phone']) if (wantProfile(profile)) add(page, profile, mode, 'default');
    }
  }
  return { runs, notices };
}

/** Playwright context options for a profile x variant. */
export function contextOptions(profileName, variantName) {
  const p = PROFILES[profileName], v = VARIANTS[variantName];
  return {
    viewport: p.viewport, isMobile: p.isMobile, hasTouch: p.hasTouch, deviceScaleFactor: p.deviceScaleFactor,
    reducedMotion: v.reducedMotion, locale: 'nl-BE', timezoneId: 'Europe/Brussels', colorScheme: 'dark',
    serviceWorkers: 'block', javaScriptEnabled: true,
  };
}

/** Human-readable label for a run, used in logs and the report. */
export function runLabel(r) {
  return `${r.page} [${r.profile} ${r.mode}${r.variant !== 'default' ? ' ' + r.variant : ''}]`;
}
