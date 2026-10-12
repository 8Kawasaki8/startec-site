/* Brasserie Meridiaan: tafelaanvraag (demo, er wordt niets verzonden) en de gescripte assistent. */
(function () {
  "use strict";
  var M = window.MERIDIAAN;
  if (!M) return;
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* =================== Tafelaanvraag =================== */
  var form = $("#res-form");
  if (form) initReservation();

  function initReservation() {
    var now = M.now();
    var todayIso = M.isoDate(now);
    var state = { date: null, time: null, size: 2, name: "", phone: "", note: "" };
    var dateIn = $("#res-date"), dateHint = $("#res-date-hint");
    var slotsBox = $("#res-slots"), slotsHint = $("#res-slots-hint");
    var nameIn = $("#res-name"), nameHint = $("#res-name-hint");
    var phoneIn = $("#res-phone"), phoneHint = $("#res-phone-hint");
    var sizeOut = $("#res-size"), errorBox = $("#res-error");
    var done = $("#res-done");
    var hintDefaults = { date: dateHint.textContent, phone: phoneHint.textContent, slots: "" };

    dateIn.min = todayIso;
    /* Vooraf ingevuld: vandaag als er nog een tafel kan, anders de eerstvolgende open dag. */
    var h = M.dayHours(now);
    var canToday = h && M.minutesOf(now) + 30 <= M.toMin(h.close) - M.LAST_SEATING;
    dateIn.value = canToday ? todayIso : M.isoDate(M.nextOpening(now).date);

    function setErr(input, hint, msg) {
      if (input) input.setAttribute("aria-invalid", "true");
      hint.textContent = msg;
      hint.classList.add("is-error");
    }
    function clearErr(input, hint, fallback) {
      if (input) input.removeAttribute("aria-invalid");
      if (hint.classList.contains("is-error")) { hint.classList.remove("is-error"); hint.textContent = fallback || ""; }
    }

    function renderSlots(s) {
      slotsBox.innerHTML = [["Middag", s.lunch], ["Avond", s.dinner]].map(function (g) {
        return '<div class="slot-group"><span>' + g[0] + '</span><div class="slots">' + g[1].map(function (x) {
          var id = "slot-" + x.value.replace(":", "");
          return '<span class="slot"><input type="radio" name="time" id="' + id + '" value="' + x.value + '"' +
            (x.past ? " disabled" : "") + '><label for="' + id + '">' + x.value + "</label></span>";
        }).join("") + "</div></div>";
      }).join("");
    }

    function onDate() {
      var v = dateIn.value;
      state.time = null;
      slotsBox.innerHTML = "";
      clearErr(null, slotsHint);
      if (!v) {
        state.date = null;
        slotsHint.textContent = "Kies eerst een datum.";
        return update();
      }
      if (v < todayIso) {
        state.date = null;
        setErr(dateIn, dateHint, "Die dag is al voorbij. Kies een datum vanaf vandaag.");
        slotsHint.textContent = "Kies eerst een geldige datum.";
        return update();
      }
      clearErr(dateIn, dateHint, hintDefaults.date);
      state.date = M.parseIso(v);
      var s = M.slots(state.date, now);
      if (!s) {
        slotsHint.textContent = "Op " + M.DAYS[state.date.getDay()] + " zijn we gesloten. Kies een andere dag.";
        return update();
      }
      renderSlots(s);
      var open = s.lunch.concat(s.dinner).filter(function (x) { return !x.past; }).length;
      slotsHint.textContent = open ? "Laatste tafel anderhalf uur voor sluitingstijd." : "Vandaag zijn er geen tijdstippen meer. Kies een andere dag.";
      update();
    }

    function sizeText(n) { return n + (n === 1 ? " persoon" : " personen"); }
    function update() {
      var rows = { date: state.date ? M.cap(M.fmtDate(state.date)) : "—", time: state.time || "—",
        size: sizeText(state.size), name: state.name || "—", phone: state.phone || "—" };
      Object.keys(rows).forEach(function (k) { $('[data-sum="' + k + '"]').textContent = rows[k]; });
      var title = $("#ticket-title");
      title.textContent = state.date ? M.cap(M.fmtDate(state.date)) + (state.time ? " om " + state.time : "") : "Nog geen datum gekozen";
      title.classList.toggle("is-empty", !state.date);
    }

    dateIn.addEventListener("change", onDate);
    dateIn.addEventListener("input", onDate);
    slotsBox.addEventListener("change", function (e) {
      if (e.target.name !== "time") return;
      state.time = e.target.value;
      clearErr(null, slotsHint, "Laatste tafel anderhalf uur voor sluitingstijd.");
      update();
    });
    $$(".step").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.size = Math.min(M.PLACE.maxOnline, Math.max(1, state.size + Number(btn.getAttribute("data-step"))));
        sizeOut.textContent = String(state.size);
        $$(".step").forEach(function (b) {
          var d = Number(b.getAttribute("data-step"));
          b.disabled = (d < 0 && state.size <= 1) || (d > 0 && state.size >= M.PLACE.maxOnline);
        });
        update();
      });
    });
    [["name", nameIn], ["phone", phoneIn], ["note", $("#res-note")]].forEach(function (p) {
      p[1].addEventListener("input", function () { state[p[0]] = p[1].value.trim(); update(); });
    });

    function validPhone(v) { return /^\+?\d{8,15}$/.test(v.replace(/[\s./-]/g, "")); }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errs = [];
      clearErr(dateIn, dateHint, hintDefaults.date);
      clearErr(nameIn, nameHint, "");
      clearErr(phoneIn, phoneHint, hintDefaults.phone);
      if (!state.date) errs.push([dateIn, dateHint, "Kies een datum vanaf vandaag."]);
      else if (!state.time) errs.push([null, slotsHint, "Kies nog een tijdstip."]);
      if (!state.name) errs.push([nameIn, nameHint, "Vul je naam in, dan weten we voor wie de tafel is."]);
      if (!validPhone(state.phone)) errs.push([phoneIn, phoneHint, "Vul een telefoonnummer in, bijvoorbeeld +32 470 00 00 00."]);
      if (errs.length) {
        errs.forEach(function (x) { setErr(x[0], x[1], x[2]); });
        errorBox.textContent = errs.length === 1 ? "Nog een ding om aan te vullen." : "Nog " + errs.length + " dingen om aan te vullen.";
        var first = errs[0][0] || slotsBox.querySelector("input:not(:disabled)");
        if (first) first.focus();
        return;
      }
      errorBox.textContent = "";
      $("#done-summary").textContent = M.cap(M.fmtDate(state.date)) + " om " + state.time + ", " + sizeText(state.size) +
        ", op naam van " + state.name + ". Het team belt of appt je op " + state.phone + "." +
        (state.note ? " Je opmerking: “" + state.note + "”." : "");
      form.hidden = true;
      done.hidden = false;
      if (window.gsap && !M.reduced) window.gsap.fromTo(done, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .7, ease: "power3.out" });
      done.focus({ preventScroll: true });
      M.scrollToEl(done, -96);
    });

    $("#res-reset").addEventListener("click", function () {
      form.reset();
      state.name = ""; state.phone = ""; state.note = ""; state.size = 2;
      sizeOut.textContent = "2";
      $$(".step").forEach(function (b) { b.disabled = false; });
      dateIn.value = canToday ? todayIso : M.isoDate(M.nextOpening(now).date);
      done.hidden = true;
      form.hidden = false;
      onDate();
      dateIn.focus({ preventScroll: true });
      M.scrollToEl(form, -96);
    });

    onDate();
  }

  /* =================== Vraag het Meridiaan (gescripte demo) =================== */
  var chat = $("#chat");
  if (chat) initChat();

  function initChat() {
    var log = $("#chat-log"), sr = $("#chat-sr"), chipsBox = $("#chat-chips"), cform = $("#chat-form"), cin = $("#chat-input");
    var P = M.PLACE;
    var UNKNOWN = "Dat weet ik niet zeker. Ik geef je vraag door aan het team.";

    function answerOpen() {
      var now = M.now(), h = M.dayHours(now), mins = M.minutesOf(now);
      var n = M.nextOpening(now);
      if (h && mins < M.toMin(h.close)) {
        var last = M.toMin(h.close) - M.LAST_SEATING;
        if (mins < last) return "Ja, vanavond zijn we open tot " + h.close + ". De laatste tafel starten we om " + M.fromMin(last) + ", dus reserveer gerust tot dan.";
        return "We zijn nog open tot " + h.close + ", maar de laatste tafel van vanavond is al gestart. " + M.cap(M.DAYS[n.date.getDay()]) + " zijn we er weer vanaf " + n.hours.open + ".";
      }
      return (h ? "Vanavond niet meer, we sloten om " + h.close + ". " : "Vanavond zijn we gesloten, " + M.DAYS[now.getDay()] + " is onze sluitingsdag. ") +
        M.cap(M.DAYS[n.date.getDay()]) + " zijn we er weer vanaf " + n.hours.open + ".";
    }
    function answerVeg() {
      var veg = M.MENU.filter(function (d) { return d.tag === "veg" && d.cat !== "na"; });
      return "Zeker. Op de kaart staan " + veg.length + " vegetarische gerechten, zoals " + veg[0].name + " en " + veg[veg.length - 1].name + ". " + P.vegMenu;
    }
    function answerGroup() {
      return "Tot " + P.maxOnline + " personen zet je een aanvraag klaar op deze pagina, met 8 lukt dat dus nog net. Groter gezelschap? Bel " + P.phone + ", dan bekijken we de salon achteraan (tot " + P.salonSeats + " personen).";
    }
    function answerTerrace() {
      var m = M.now().getMonth() + 1;
      var inSeason = m >= P.terraceSeason[0] && m <= P.terraceSeason[1];
      return P.terrace + (inSeason ? " Deze maand staat het terras buiten." : " Deze maand staat het terras binnen, tot april.");
    }
    var QA = [
      { q: "Zijn jullie vanavond open?", a: answerOpen },
      { q: "Is er een vegetarisch menu?", a: answerVeg },
      { q: "Kan ik met 8 personen komen?", a: answerGroup },
      { q: "Waar parkeer ik?", a: function () { return "Het makkelijkst is " + P.parking; } },
      { q: "Hebben jullie een terras?", a: answerTerrace }
    ];

    function scrollLog() { log.scrollTop = log.scrollHeight; }
    function bubble(kind, text) {
      var el = document.createElement("div");
      el.className = "msg " + kind;
      var span = document.createElement("span");
      span.className = "msg-text";
      span.textContent = text;
      var t = document.createElement("time");
      t.textContent = M.fmtTime(M.now());
      el.appendChild(span);
      el.appendChild(t);
      log.appendChild(el);
      scrollLog();
      return span;
    }
    function typingBubble() {
      var el = document.createElement("div");
      el.className = "msg bot";
      el.innerHTML = '<span class="typing" aria-hidden="true"><i></i><i></i><i></i></span>';
      log.appendChild(el);
      scrollLog();
      return el;
    }
    function typeInto(span, text, cb) {
      if (M.reduced) { span.textContent = text; scrollLog(); return cb(); }
      var i = 0;
      (function step() {
        i = Math.min(text.length, i + 2);
        span.textContent = text.slice(0, i);
        scrollLog();
        if (i < text.length) window.setTimeout(step, 18); else cb();
      })();
    }
    function ask(question, answer) {
      if (chat.getAttribute("aria-busy") === "true") return;
      chat.setAttribute("aria-busy", "true");
      bubble("user", question);
      var typing = typingBubble();
      var wait = M.reduced ? 150 : 800 + Math.min(700, answer.length * 3);
      window.setTimeout(function () {
        typing.remove();
        var span = bubble("bot", "");
        typeInto(span, answer, function () {
          sr.textContent = "Meridiaan: " + answer;
          chat.setAttribute("aria-busy", "false");
        });
      }, wait);
    }

    QA.forEach(function (item) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "qchip";
      b.textContent = item.q;
      b.addEventListener("click", function () { ask(item.q, item.a()); });
      chipsBox.appendChild(b);
    });
    cform.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = cin.value.trim();
      if (!v) { cin.focus(); return; }
      cin.value = "";
      ask(v, UNKNOWN);
    });

    bubble("bot", "Dag! Ik ben de assistent van " + P.name + ". Ik antwoord alleen met wat ik zeker weet. Kies een vraag hieronder of typ er zelf een.");
  }
})();
