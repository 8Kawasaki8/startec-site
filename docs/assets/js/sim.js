/* Doorlichting engine (simulatie.html, src/rooms/doorlichting.html). One GSAP master timeline owns
   every beat of a run (log lines typed, chart revealed by the scan, reticle locked, callout, finding,
   advice), so speed, pause (tab hidden / room off-screen) and 'skip to the end' are operations on
   that one timeline. Charts: sim-charts.js (window.SIM_CHARTS, pure). Data: sim-data.js and
   sim-data-2.js (window.SIM_DATA). The phase board (flap.js) is driven only by the timeline's labels
   VERKENNEN, METEN, LEZEN, ADVIES, WACHT OP SNYMIS, read with tl.currentLabel() on every tick. The
   wat-als switches (sim-whatif.js) listen to the 'sts:sim' event and call STSSim.showChart(i, 'final', alt).
   The stage always names the fictional business. The visitor's record (STSState) feeds only the
   context line above the stage and preselects the business whose trade matches the sector
   (SIM_DATA.sectorMap, sim-data-2.js); it never enters a chart, a log line or a finding.
   Pause: room hooks window.STS_ROOMS.doorlichting {init, enter, leave} (uithangbord.js) plus
   visibilitychange; pagehide kills the timeline and the board. The timeline is killed when the run
   ends and gsap.config({autoSleep: 10}) lets the ticker sleep within 10 frames, so nothing ticks
   afterwards. Reduced motion: a run jumps to its end state. Lite (?lite or
   sts-lite): the log types at 2000 characters per second instead of 80.
   API: window.STSSim = { showChart(i, mode, alt), biz(), status(), debug }. */
(function () {
  var D = window.SIM_DATA, CH = window.SIM_CHARTS, room = document.getElementById("room");
  if (!D || !CH || !window.gsap || !room) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, lite = /[?&]lite\b/.test(location.search);
  try { lite = lite || localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  var $ = function (id) { return document.getElementById(id); };
  var E = { stage: $("stage"), wrap: $("chart-wrap"), chart: $("sim-chart"), ret: $("sim-ret"), callout: $("sim-callout"), log: $("sim-log"),
    finds: $("sim-find"), findEmpty: $("find-empty"), findCount: $("find-count"), logCount: $("log-count"), tabs: $("sim-tabs"), legend: $("sim-legend"),
    title: $("chart-title"), sub: $("chart-sub-txt"), src: $("chart-src"), biz: $("stage-biz"), place: $("stage-place"), phase: $("sim-phase"),
    clock: $("sim-clock"), prog: $("sim-prog"), advice: $("sim-advice"), advNote: $("adv-note"), human: document.querySelector(".human"),
    humState: $("hum-state"), start: $("sim-start"), reset: $("sim-reset"), skips: [$("sim-skip"), $("sim-skip2")].filter(Boolean), room: room,
    context: $("sim-context"), flap: $("sim-flap"), live: $("sim-live"), cta: $("sim-cta"), pick: document.querySelector("[data-sim-pick]") };
  var S = { biz: "noordpool", speed: 1, status: "idle", tl: null, chart: 0, cur: null, alt: null, locked: false, hidden: false, off: false, lines: [], finds: [], advs: [], lastSec: -1, label: "", seenSector: null, zaak: null };
  var TYPE = lite ? 2000 : 80;      /* characters per second in the log */
  var esc = CH.esc;
  var flap = window.STSFlap && E.flap ? window.STSFlap.mount(E.flap, { reduce: reduce, lite: lite }) : null;
  gsap.config({ autoSleep: 10 });          /* the ticker checks every 10 frames (not 120) whether anything still tweens; rust is 0 rAF within 200 ms of the last beat */

  /* ── helpers ──────────────────────────────────────────────── */
  function clock(t) { t = Math.max(0, Math.floor(t)); return (t < 600 ? "0" : "") + Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); }
  function biz() { return D.businesses[S.biz]; }
  function emit(type, extra) {
    var d = { type: type, status: S.status, biz: S.biz, chart: S.chart, alt: !!S.alt }; for (var k in extra) d[k] = extra[k];
    try { window.dispatchEvent(new CustomEvent("sts:sim", { detail: d })); } catch (e) { /* no CustomEvent */ }
  }
  function phases(tl) { return Object.keys(tl.labels).sort(function (a, b) { return tl.labels[a] - tl.labels[b]; }); }

  /* ── reticle layer: built once, moved by transforms only ──── */
  var RL = {};
  function buildRet() {
    var ns = "http://www.w3.org/2000/svg", mk = function (tag, attrs, parent) { var el = document.createElementNS(ns, tag); for (var k in attrs) el.setAttribute(k, attrs[k]); (parent || E.ret).appendChild(el); return el; };
    E.ret.innerHTML = '<defs><linearGradient id="sim-scan-grad" x1="0" x2="1"><stop offset="0" stop-color="#36E8FF" stop-opacity="0"/><stop offset="1" stop-color="#36E8FF" stop-opacity=".2"/></linearGradient></defs>';
    RL.scan = mk("g", { opacity: 0 }); RL.wash = mk("rect", { "class": "scan-wash", x: -90, y: 0, width: 90, height: 10 }, RL.scan); RL.line = mk("line", { "class": "scan-line", x1: 0, x2: 0, y1: 0, y2: 10 }, RL.scan);
    RL.g = mk("g", { opacity: 0 }); RL.dim = []; RL.glow = []; RL.fr = []; RL.cn = [];
    for (var i = 0; i < 4; i++) RL.dim.push(mk("rect", { "class": "dim", width: 1, height: 1 }, RL.g));
    for (i = 0; i < 4; i++) RL.glow.push(mk("line", { "class": "fr-glow", x1: 0, y1: 0, x2: i < 2 ? 1 : 0, y2: i < 2 ? 0 : 1 }, RL.g));
    for (i = 0; i < 4; i++) RL.fr.push(mk("line", { "class": "fr", x1: 0, y1: 0, x2: i < 2 ? 1 : 0, y2: i < 2 ? 0 : 1 }, RL.g));
    for (i = 0; i < 4; i++) RL.cn.push(mk("path", { "class": "corner", d: "M0 9V0H9" }, RL.g));
    RL.lead = mk("line", { "class": "lead", opacity: 0 });
  }
  function drawRet(x, y, w, h, o) {
    var W = S.cur.W, H = S.cur.H, t = function (el, v) { el.setAttribute("transform", v); };
    t(RL.dim[0], "translate(0 0) scale(" + W + " " + Math.max(0, y) + ")"); t(RL.dim[1], "translate(0 " + (y + h) + ") scale(" + W + " " + Math.max(0, H - y - h) + ")");
    t(RL.dim[2], "translate(0 " + y + ") scale(" + Math.max(0, x) + " " + h + ")"); t(RL.dim[3], "translate(" + (x + w) + " " + y + ") scale(" + Math.max(0, W - x - w) + " " + h + ")");
    var tf = ["translate(" + x + " " + y + ") scale(" + w + " 1)", "translate(" + x + " " + (y + h) + ") scale(" + w + " 1)", "translate(" + x + " " + y + ") scale(1 " + h + ")", "translate(" + (x + w) + " " + y + ") scale(1 " + h + ")"];
    for (var i = 0; i < 4; i++) { t(RL.fr[i], tf[i]); t(RL.glow[i], tf[i]); }
    t(RL.cn[0], "translate(" + x + " " + y + ")"); t(RL.cn[1], "translate(" + (x + w) + " " + y + ") rotate(90)"); t(RL.cn[2], "translate(" + (x + w) + " " + (y + h) + ") rotate(180)"); t(RL.cn[3], "translate(" + x + " " + (y + h) + ") rotate(270)");
    RL.g.setAttribute("opacity", o);
  }
  var P = { p: 0 }, L = { k: 0 };
  function drawReveal() {
    if (!S.cur) return; var f = S.cur.frame, p = P.p, clip = $("sim-clip-r");
    if (clip) clip.setAttribute("transform", "scale(" + Math.max(p, 0.001) + " 1)");
    RL.scan.setAttribute("transform", "translate(" + (f.x0 + p * (f.x1 - f.x0)) + " 0)"); RL.scan.setAttribute("opacity", Math.min(1, p * 6, (1 - p) * 6));
  }
  function drawLock() {
    if (!S.cur) return; var f = S.cur.frame, F = S.cur.focus, k = L.k, e = function (a, b) { return a + (b - a) * k; };
    drawRet(e(f.x1, F.x), e(f.y0, F.y), e(0, F.w), e(f.y1 - f.y0, F.h), k); S.locked = k > 0.99;
  }
  function lockNow() { L.k = 1; drawLock(); }
  function placeCallout(i) {
    var b = biz(), c = b[CH.order[i]].callout; E.callout.querySelector(".v").textContent = c.v; E.callout.querySelector(".t").textContent = c.t;
    RL.lead.setAttribute("opacity", 0);
    if (!matchMedia("(min-width: 761px)").matches) return;
    var F = S.cur.focus, W = S.cur.W, H = S.cur.H, cw = 232, ch = 64, cp = S.cur.cpos, ox = E.wrap.offsetLeft, oy = E.wrap.offsetTop, left, top, lead = null;
    var cx = function (v) { return Math.min(Math.max(4, v), W - cw - 4); }, cy = function (v) { return Math.min(Math.max(4, v), H - ch - 4); };
    if (cp) { left = cx(cp.x); top = cy(cp.y); }                                 /* the chart knows its empty region */
    else if (F.x + F.w + 12 + cw <= W) { left = F.x + F.w + 12; top = cy(F.y - 2); }
    else if (F.x - 12 - cw >= 0) { left = F.x - 12 - cw; top = cy(F.y - 2); }
    else { left = cx(F.x + F.w / 2 - cw / 2); top = F.y > 90 ? F.y - ch - 10 : cy(F.y + F.h + 10); }
    if (left >= F.x + F.w) lead = [left, top + 16, F.x + F.w, F.y];              /* lead line from the nearest callout edge */
    else if (left + cw <= F.x) lead = [left + cw, top + 16, F.x, F.y];
    else if (top >= F.y + F.h) lead = [left + 18, top, Math.min(F.x + 18, F.x + F.w), F.y + F.h];
    else if (top + ch <= F.y) lead = [left + 18, top + ch, F.x + 18, F.y];
    E.callout.style.left = (ox + left) + "px"; E.callout.style.top = (oy + top) + "px"; E.callout.style.width = cw + "px";
    if (lead) { RL.lead.setAttribute("x1", lead[0]); RL.lead.setAttribute("y1", lead[1]); RL.lead.setAttribute("x2", lead[2]); RL.lead.setAttribute("y2", lead[3]); RL.lead.setAttribute("opacity", 0.7); }
  }

  /* ── stage ────────────────────────────────────────────────── */
  function showChart(i, mode, alt) {
    var b = biz(), id = CH.order[i], m = CH.meta(b, id), W = Math.max(280, Math.round(E.wrap.clientWidth || 600)), H = W < 520 ? 262 : 330, out = CH[id](b, W, H, alt || null);
    S.chart = i; S.cur = out; out.W = W; out.H = H; S.locked = false; S.alt = alt || null;
    E.chart.innerHTML = out.svg; E.legend.innerHTML = out.legend; E.title.textContent = m.title; E.sub.textContent = m.sub; E.src.textContent = m.src;
    E.ret.setAttribute("viewBox", "0 0 " + W + " " + H); RL.wash.setAttribute("height", H); RL.line.setAttribute("y2", H);
    E.tabs.querySelectorAll("button").forEach(function (t, k) { t.classList.toggle("active", k === i); t.classList.toggle("done", mode !== "idle" && (k < i || (k === i && mode === "final")) || S.status === "done"); t.setAttribute("aria-pressed", k === i); });
    gsap.set(E.callout, { autoAlpha: 0 }); RL.lead.setAttribute("opacity", 0); RL.scan.setAttribute("opacity", 0);
    P.p = mode === "run" ? 0 : 1; drawReveal(); RL.scan.setAttribute("opacity", 0);
    if (mode === "final") { lockNow(); placeCallout(i); gsap.set(E.callout, { autoAlpha: 1, y: 0 }); } else RL.g.setAttribute("opacity", 0);
    emit("chart");
  }
  function setPhase(s) { E.phase.textContent = s; }
  function showFinding(i) { E.findEmpty.hidden = true; S.finds[i].hidden = false; E.findCount.textContent = (i + 1) + " van 4"; E.finds.scrollTop = E.finds.scrollHeight; }
  function showAdvice() { S.advs.forEach(function (a) { a.hidden = false; }); E.advNote.textContent = "Drie acties, gerangschikt op impact. " + D.advice_note.charAt(0).toUpperCase() + D.advice_note.slice(1) + "."; }
  function humanWait() { E.human.classList.add("wait"); E.humState.textContent = "Wacht op goedkeuring van een mens"; }
  function scrollLog() { E.log.scrollTop = E.log.scrollHeight; }
  /* the context line: the visitor's name appears here and nowhere else in the room */
  function contextLine() {
    if (!E.context) return;
    var b = biz(), s = S.zaak, t = "Hieronder: de verzonnen " + b.name + ", " + b.place + ". Jouw echte cijfers kennen we niet.";
    if (s && s.zaak) t = "Jouw zaak: " + s.zaak + (s.gemeente ? ", " + s.gemeente : "") + ". " + t;
    E.context.textContent = t;
  }
  function selectBiz(key) {
    if (!D.businesses[key]) return;
    S.biz = key;
    if (E.pick) [].forEach.call(E.pick.querySelectorAll("input[name=sim-biz]"), function (r) { r.checked = r.value === key; });
    E.biz.textContent = biz().name; E.place.textContent = biz().place + " · fictief";
    reset(); contextLine();
  }

  /* ── a run: pre-build the DOM, then one master timeline ────── */
  function prepareRun() {
    var b = biz(); S.lines = []; S.finds = []; S.advs = [];
    E.finds.querySelectorAll(".find").forEach(function (n) { n.remove(); }); E.advice.innerHTML = "";
    b.findings.forEach(function (f) {
      var el = document.createElement("article"); el.className = "find"; el.hidden = true;
      el.innerHTML = '<span class="sev ' + esc(f.sev) + '">' + esc(f.sev) + "</span><h4>" + esc(f.title) + '</h4><p class="num">' + esc(f.value) + '</p><p class="proof">' + esc(f.proof) + "</p>";
      E.finds.appendChild(el); S.finds.push(el);
    });
    b.advice.forEach(function (a, i) {
      var el = document.createElement("article"); el.className = "adv"; el.hidden = true;
      el.innerHTML = '<span class="n">actie ' + (i + 1) + "</span><h4>" + esc(a.title) + "</h4><p>" + esc(a.why) + '</p><p class="imp">' + esc(a.impact) + '</p><span class="est">' + esc(D.advice_note) + "</span>";
      E.advice.appendChild(el); S.advs.push(el);
    });
  }
  function addLine(agent, txt, t) {
    var li = document.createElement("li"); if (agent === "systeem") li.className = "sys";
    li.innerHTML = '<span class="ts">' + clock(t) + '</span><span class="ag">[' + esc(agent) + ']</span><span class="tx"></span>';
    li._text = txt; E.log.appendChild(li); S.lines.push(li); return li;
  }
  function buildTimeline() {
    var b = biz(), tl = gsap.timeline({ paused: true, onUpdate: tick, onComplete: done }), t = 0;
    function say(agent, txt) {
      var li = addLine(agent, txt, t), tx = li.querySelector(".tx"), o = { n: 0 }, dur = Math.max(0.4, txt.length / TYPE);
      tl.call(function () { li.classList.add("on", "typing"); scrollLog(); }, null, t);
      tl.fromTo(o, { n: 0 }, { n: txt.length, duration: dur, ease: "none", onUpdate: function () { tx.textContent = txt.slice(0, Math.round(o.n)); if (Math.round(o.n) % 12 === 0) scrollLog(); } }, t);
      tl.call(function () { li.classList.remove("typing"); tx.textContent = txt; scrollLog(); }, null, t + dur);
      t += dur + 0.3;
    }
    tl.addLabel("VERKENNEN", 0); tl.call(setPhase, ["leest het profiel"], 0);
    say("systeem", "Doorlichting gestart: " + b.name + ", " + b.place + ". Alle data is gesimuleerd.");
    b.log.intro.forEach(function (l) { say(l[0], l[1]); });
    CH.order.forEach(function (id, i) {
      var m = CH.meta(b, id);
      if (i === 0) tl.addLabel("METEN", t); else if (i === 2) tl.addLabel("LEZEN", t);
      tl.call(setPhase, ["leest " + m.tab.toLowerCase() + " · grafiek " + (i + 1) + " van 4"], t);
      say(b.log[id][0][0], b.log[id][0][1]);
      tl.call(showChart, [i, "run"], t);
      tl.fromTo(P, { p: 0 }, { p: 1, duration: 1.8, ease: "none", onUpdate: drawReveal }, t); t += 1.9;
      tl.fromTo(L, { k: 0 }, { k: 1, duration: 0.65, ease: "power3.inOut", onUpdate: drawLock }, t); t += 0.75;
      tl.call(placeCallout, [i], t); tl.fromTo(E.callout, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, immediateRender: false }, t); t += 0.35;
      say(b.log[id][1][0], b.log[id][1][1]);
      tl.call(showFinding, [i], t - 0.02); tl.fromTo(S.finds[i], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, immediateRender: false }, t); t += 1.1;
    });
    tl.addLabel("ADVIES", t); tl.call(setPhase, ["stelt het advies op"], t);
    say(b.log.advice[0], b.log.advice[1]);
    tl.call(showAdvice, [], t - 0.02); tl.fromTo(S.advs, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.14, immediateRender: false }, t); t += 0.9;
    tl.addLabel("WACHT OP SNYMIS", t);
    say("systeem", D.end_line);
    tl.call(humanWait, [], t);
    return tl;
  }
  function tick() {
    var tl = S.tl; if (!tl) return; E.prog.style.transform = "scaleX(" + tl.progress().toFixed(4) + ")";
    var s = Math.floor(tl.time()); if (s !== S.lastSec) { S.lastSec = s; E.clock.textContent = clock(s); }
    var lab = tl.currentLabel() || ""; if (lab !== S.label) { S.label = lab; if (flap) flap.set(lab); }
  }
  function done() {
    S.status = "done"; E.room.classList.remove("running"); setPhase("klaar · wacht op een mens");
    if (S.tl) { var last = phases(S.tl).pop(); S.tl.kill(); S.tl = null; if (flap && last && S.label !== last) { S.label = last; flap.set(last); } }
    E.tabs.querySelectorAll("button").forEach(function (t) { t.classList.add("can", "done"); });
    if (E.live) E.live.textContent = "Doorlichting van " + biz().name + " klaar: vier bevindingen en drie acties. Wacht op goedkeuring van een mens; er vertrekt niets automatisch.";
    emit("status");
  }
  function finish() {                                  /* skip to the end (also the reduced-motion path) */
    if (S.status === "idle") { prepareRun(); if (!S.tl) S.tl = buildTimeline(); }
    var total = S.tl ? S.tl.duration() : 0;
    S.lines.forEach(function (li) { li.classList.add("on"); li.classList.remove("typing"); li.querySelector(".tx").textContent = li._text; });
    S.finds.concat(S.advs).forEach(function (el) { el.hidden = false; }); gsap.set(S.finds.concat(S.advs), { autoAlpha: 1, y: 0 });
    E.stage.classList.remove("idle"); showFinding(3); showAdvice(); humanWait(); scrollLog();
    E.prog.style.transform = "scaleX(1)"; E.clock.textContent = clock(total); E.start.disabled = true; E.reset.disabled = false;
    done(); showChart(3, "final");
  }
  function reset() {
    if (S.tl) S.tl.kill(); S.tl = null; S.status = "idle"; S.lastSec = -1; S.label = ""; S.alt = null;
    E.log.innerHTML = ""; E.finds.querySelectorAll(".find").forEach(function (n) { n.remove(); }); E.findEmpty.hidden = false; E.advice.innerHTML = "";
    E.findCount.textContent = "0 van 4"; E.advNote.textContent = "Drie acties, gerangschikt op impact. Verschijnen na de vier grafieken."; E.human.classList.remove("wait"); E.humState.textContent = "Nog geen advies";
    E.room.classList.remove("running"); E.stage.classList.add("idle"); E.skips.forEach(function (a) { a.hidden = true; });
    E.start.disabled = false; E.reset.disabled = true; E.prog.style.transform = "scaleX(0)"; E.clock.textContent = "00:00"; setPhase("standby");
    E.tabs.querySelectorAll("button").forEach(function (t) { t.classList.remove("can", "done"); });
    if (flap) flap.clear(); if (E.live) E.live.textContent = "";
    emit("status"); showChart(0, "idle");
  }
  function start() {
    if (S.status === "running") return;
    reset(); S.status = "running"; S.off = false; prepareRun(); S.tl = buildTimeline(); S.tl.timeScale(S.speed);
    E.stage.classList.remove("idle"); E.room.classList.add("running"); E.skips.forEach(function (a) { a.hidden = false; });
    E.start.disabled = true; E.reset.disabled = false; emit("status");
    var r = E.room.getBoundingClientRect();                   /* bring the whole room into view when the start button sat above it */
    if (r.top < 60 || r.bottom > innerHeight) scrollTo({ top: scrollY + r.top - 84, behavior: reduce ? "auto" : "smooth" });
    if (reduce) finish(); else { syncPause(); if (!S.hidden && !S.off) S.tl.play(0); }
  }
  function syncPause() {
    if (!S.tl || S.status !== "running") return;
    if (S.hidden || S.off) { S.tl.pause(); setPhase("gepauzeerd · " + (S.hidden ? "tabblad verborgen" : "ruimte buiten beeld")); }
    else if (S.tl.paused()) { S.tl.play(); setPhase("gaat verder"); }
  }

  /* ── wiring ───────────────────────────────────────────────── */
  buildRet();
  CH.order.forEach(function (id, i) {
    var c = CH.meta(null, id), btn = document.createElement("button"); btn.type = "button"; btn.innerHTML = "<b>" + c.n + "</b><span>" + esc(c.tab) + "</span>"; btn.setAttribute("aria-label", "Grafiek " + c.n + ": " + c.tab);
    btn.addEventListener("click", function () { if (S.status === "done") showChart(i, "final"); }); E.tabs.appendChild(btn);
  });
  E.logCount.textContent = D.agents.length + " agents · 1 mens";
  if (E.pick) E.pick.addEventListener("change", function (e) { if (e.target.name === "sim-biz") selectBiz(e.target.value); });
  document.querySelectorAll(".seg [data-speed]").forEach(function (b) {
    b.addEventListener("click", function () { S.speed = +b.getAttribute("data-speed"); document.querySelectorAll(".seg [data-speed]").forEach(function (o) { o.setAttribute("aria-pressed", o === b); }); if (S.tl) S.tl.timeScale(S.speed); });
  });
  E.start.addEventListener("click", start);
  E.reset.addEventListener("click", reset);
  E.skips.forEach(function (a) { a.addEventListener("click", function () { if (S.status !== "done") finish(); }); });
  /* the Bericht: the key plus the three advice titles of the fictional business (contact-prefill.js composes the text) */
  if (E.cta) E.cta.addEventListener("click", function (e) {
    var B = window.STSBericht; if (!B) return;
    e.preventDefault();
    var b = biz(), lines = ["In de doorlichting van de verzonnen " + b.name + " kwamen deze drie acties naar boven:"].concat(b.advice.map(function (a, i) { return (i + 1) + ". " + a.title; }));
    B.prefill({ key: "doorlichting", subject: E.cta.getAttribute("data-bericht-subject") || undefined, lines: lines });
  });
  /* pause on leave, on hidden, on pagehide: the room hooks of uithangbord.js, plus our own listeners for pages without it */
  var ROOMS = window.STS_ROOMS = window.STS_ROOMS || {};
  ROOMS.doorlichting = {
    init: function () { /* the DOM is prepared at load; nothing to do twice */ },
    enter: function () { S.off = false; S.hidden = document.hidden; syncPause(); },
    leave: function () { S.off = true; syncPause(); }
  };
  document.addEventListener("visibilitychange", function () { S.hidden = document.hidden; syncPause(); });
  addEventListener("pagehide", function () { if (S.tl) { S.tl.kill(); S.tl = null; } if (flap) flap.kill(); }, { once: true });
  var rt; addEventListener("resize", function () {
    clearTimeout(rt); rt = setTimeout(function () {
      if (S.status === "idle") showChart(S.chart, "idle"); else if (S.status === "done") showChart(S.chart, "final", S.alt);
      else { var was = S.locked, p = P.p; showChart(S.chart, "run"); P.p = p; drawReveal(); if (was) { lockNow(); placeCallout(S.chart); gsap.set(E.callout, { autoAlpha: 1, y: 0 }); } }
    }, 150);
  });
  /* the shared record: context line, and the chip of the matching trade while nothing runs */
  function onState(s) {
    S.zaak = s; contextLine();
    var key = s.sector && D.sectorMap ? D.sectorMap[s.sector] : "";
    if (s.sector !== S.seenSector) { S.seenSector = s.sector; if (key && key !== S.biz && S.status === "idle") selectBiz(key); }
  }
  window.STSSim = { showChart: showChart, biz: function () { return S.biz; }, status: function () { return S.status; },
    debug: { get status() { return S.status; }, get biz() { return S.biz; }, get chart() { return S.chart; }, get alt() { return !!S.alt; }, get label() { return S.label; }, get lite() { return lite; }, get reduce() { return reduce; },
      get paused() { return !!(S.tl && S.tl.paused()); }, get timeline() { return !!S.tl; } } };
  reset();
  if (window.STSState) window.STSState.subscribe(onState); else contextLine();
})();
