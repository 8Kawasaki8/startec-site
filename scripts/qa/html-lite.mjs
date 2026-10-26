// A small, forgiving HTML parser for the static copy lint. No dependencies.
// It builds a tree of { tag, attrs, children, parent, line } and text nodes { text, line }.
// Good enough for our own templates; it is not a browser.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const SKIP_TEXT = new Set(['script', 'style', 'noscript', 'template']);
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', euro: '€', starf: '★',
  star: '☆', copy: '©', eacute: 'é', egrave: 'è', oacute: 'ó', iuml: 'ï', euml: 'ë', times: '×', laquo: '«', raquo: '»',
};

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    const v = ENTITIES[e.toLowerCase()]; return v === undefined ? m : v;
  });
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

export function parseHTML(src) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null, line: 1 };
  let cur = root, i = 0, line = 1;
  const len = src.length;
  const countLines = (from, to) => { for (let k = from; k < to; k++) if (src.charCodeAt(k) === 10) line++; };
  const text = (from, to) => { if (to > from) cur.children.push({ text: decode(src.slice(from, to)), line, parent: cur }); };
  while (i < len) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { text(i, len); countLines(i, len); break; }
    text(i, lt); countLines(i, lt);
    if (src.startsWith('<!--', lt)) { const end = src.indexOf('-->', lt + 4); const stop = end < 0 ? len : end + 3; countLines(lt, stop); i = stop; continue; }
    if (src.startsWith('<!', lt) || src.startsWith('<?', lt)) { const end = src.indexOf('>', lt); const stop = end < 0 ? len : end + 1; countLines(lt, stop); i = stop; continue; }
    const end = findTagEnd(src, lt);
    if (end < 0) { text(lt, len); break; }
    const raw = src.slice(lt + 1, end);
    countLines(lt, end + 1); i = end + 1;
    if (raw[0] === '/') { // closing tag: pop to the nearest matching open element
      const name = raw.slice(1).trim().toLowerCase();
      let n = cur; while (n && n !== root && n.tag !== name) n = n.parent;
      if (n && n !== root) cur = n.parent;
      continue;
    }
    const m = /^([a-zA-Z][^\s\/>]*)([\s\S]*?)\/?$/.exec(raw);
    if (!m) continue;
    const tag = m[1].toLowerCase();
    const node = { tag, attrs: parseAttrs(m[2]), children: [], parent: cur, line };
    cur.children.push(node);
    const selfClosing = raw.endsWith('/') || VOID.has(tag);
    if (RAW.has(tag)) { // swallow raw text up to the closing tag
      const close = src.toLowerCase().indexOf('</' + tag, i);
      const stop = close < 0 ? len : close;
      countLines(i, stop); i = stop;
      continue;
    }
    if (!selfClosing) cur = node;
  }
  return root;
}

function findTagEnd(src, lt) {
  let q = null;
  for (let k = lt + 1; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '>') return k;
  }
  return -1;
}

/** Depth-first walk over element and text nodes. */
export function walk(node, fn) {
  for (const c of node.children || []) { fn(c); if (c.children) walk(c, fn); }
}

/** Visible text of a subtree (script/style/noscript/template skipped). */
export function textOf(node) {
  if (node.text !== undefined) return node.text;
  if (SKIP_TEXT.has(node.tag)) return '';
  return (node.children || []).map(textOf).join('');
}

export function isSkipped(node) {
  for (let n = node.parent; n; n = n.parent) if (SKIP_TEXT.has(n.tag)) return true;
  return false;
}

/** Nearest ancestor (inclusive of parent) that satisfies pred. */
export function closest(node, pred) {
  for (let n = node.parent; n && n.tag !== '#root'; n = n.parent) if (pred(n)) return n;
  return null;
}

export function hasClass(node, cls) {
  return (node.attrs.class || '').split(/\s+/).includes(cls);
}

/** Short CSS-like path for messages: section#vragen > div.acc > h3 */
export function pathOf(node) {
  const parts = [];
  for (let n = node.text !== undefined ? node.parent : node; n && n.tag !== '#root' && parts.length < 4; n = n.parent) {
    let s = n.tag;
    if (n.attrs.id) s += '#' + n.attrs.id; else if (n.attrs.class) s += '.' + n.attrs.class.split(/\s+/)[0];
    parts.unshift(s);
  }
  return parts.join(' > ');
}
