/* 의대 OX 퀴즈 — 세트 파일(data/sets/*.js)이 QUIZ.register()로 문제를 등록한다.
   풀이 기록은 localStorage에 두고, 동기화를 켜면 내 GitHub 비밀 gist와 합쳐서 모든 기기가 같은 기록을 본다.
   합치는 규칙: 문항·별표마다 더 나중(t)에 바뀐 쪽이 이김, 초기화(z)는 그 시각 이전 기록을 지움.
   복습: 문항마다 단계(b)와 다음 복습일(d, 날짜 번호)을 둔다. 맞히면 단계↑·간격↑, 틀리거나 모르면 0단계·오늘 다시. */
(function () {
  "use strict";

  var SETS = {};
  var ORDER = [];
  var KEY = "mox:v1";
  var INTERVAL = [0, 1, 3, 7, 14, 30, 60]; // 단계별 다음 복습까지 날짜 수
  var LEVELS = [
    { name: "새 문제", cls: "lv-new" },
    { name: "다시 익히는 중", cls: "lv0" },
    { name: "학습 중", cls: "lv1" },
    { name: "익숙", cls: "lv2" },
    { name: "완벽", cls: "lv3" }
  ];
  var store = load();
  var session = null;
  var setOpts = {};

  // ── 저장 ──────────────────────────────────────────
  function norm(s) {
    s = s || {};
    var st = {};
    Object.keys(s.s || {}).forEach(function (k) { var v = s.s[k]; st[k] = typeof v === "object" ? v : { on: 1, t: 0 }; });
    return { r: s.r || {}, s: st, z: s.z || {}, last: s.last || null };
  }
  function load() {
    try { return norm(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return norm({}); }
  }
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
  }
  function save() {
    saveLocal();
    Sync.changed();
  }
  function merge(into, other) {
    other = norm(other);
    ["r", "s"].forEach(function (m) {
      Object.keys(other[m]).forEach(function (k) {
        var a = into[m][k], b = other[m][k];
        if (!a || (b.t || 0) > (a.t || 0)) into[m][k] = b;
      });
    });
    Object.keys(other.z).forEach(function (k) { if (!(into.z[k] >= other.z[k])) into.z[k] = other.z[k]; });
    applyResets(into);
    if (!into.last) into.last = other.last;
  }
  function applyResets(st) {
    Object.keys(st.z).forEach(function (id) {
      [st.r, st.s].forEach(function (m) {
        Object.keys(m).forEach(function (k) {
          if ((id === "*" || k.indexOf(id + ":") === 0) && (m[k].t || 0) <= st.z[id]) delete m[k];
        });
      });
    });
  }

  // ── 날짜 · 복습 일정 ──────────────────────────────
  function dayOf(ts) { var d = new Date(ts); return Math.floor((ts - d.getTimezoneOffset() * 60000) / 86400000); }
  function today() { return dayOf(Date.now()); }
  function dayFromISO(s) { var p = s.split("-"); return dayOf(new Date(+p[0], +p[1] - 1, +p[2]).getTime()); }
  function examDay(set) { return set.examDate ? dayFromISO(set.examDate) : null; }
  function dLabel(n) { return n === 0 ? "오늘" : n === 1 ? "내일" : n + "일 뒤"; }

  function rec(setId, qid) { return store.r[setId + ":" + qid]; }
  function isDue(setId, qid) { var r = rec(setId, qid); return !!r && (r.d == null ? r.l === 0 : r.d <= today()); }
  function level(r) {
    if (!r) return 0;
    var b = r.b == null ? (r.l ? 1 : 0) : r.b;
    return b === 0 ? 1 : b <= 2 ? 2 : b <= 4 ? 3 : 4;
  }
  // res: true 맞음 / false 틀림 / "?" 모르겠다
  function record(set, qid, res) {
    var k = set.id + ":" + qid;
    var r = store.r[k] || { c: 0, w: 0, u: 0 };
    var ok = res === true;
    if (ok) r.c++; else if (res === "?") r.u = (r.u || 0) + 1; else r.w++;
    var b = r.b == null ? 0 : r.b;
    r.b = ok ? Math.min(b + 1, INTERVAL.length - 1) : 0;
    var due = today() + INTERVAL[r.b];
    var ex = examDay(set);
    // 시험 전이면 다음 복습이 시험 전날을 넘지 않게
    if (ok && ex != null && today() < ex - 1) due = Math.min(due, ex - 1);
    r.d = due;
    r.l = ok ? 1 : 0;
    r.t = Date.now();
    store.r[k] = r;
  }
  function isStar(setId, qid) { var v = store.s[setId + ":" + qid]; return !!(v && v.on); }
  function toggleStar(setId, qid) {
    store.s[setId + ":" + qid] = { on: isStar(setId, qid) ? 0 : 1, t: Date.now() };
    save();
  }

  // ── 기기 간 동기화 (GitHub 비밀 gist) ──────────────
  var Sync = (function () {
    var CONF = "mox:sync", FILE = "med-ox-quiz-progress.json";
    var conf = null;
    try { conf = JSON.parse(localStorage.getItem(CONF) || "null"); } catch (e) {}
    var state = conf ? "idle" : "off", err = "", at = 0, busy = false, again = false, dirty = false, timer = null;

    function api(path, method, body) {
      return fetch("https://api.github.com" + path, {
        method: method || "GET",
        headers: { Authorization: "Bearer " + conf.token, Accept: "application/vnd.github+json" },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store"
      }).then(function (r) {
        if (r.status === 401) throw new Error("토큰이 맞지 않거나 만료됐어요");
        if (r.status === 403 || r.status === 404) throw new Error("기록 gist에 접근할 수 없어요 (토큰에 gist 권한이 있는지 확인)");
        if (!r.ok) throw new Error("GitHub 응답 " + r.status);
        return r.json();
      });
    }
    function dump() { return JSON.stringify({ v: 1, r: store.r, s: store.s, z: store.z, last: store.last }); }
    function show() {
      var el = document.getElementById("syncDot");
      if (!el) return;
      el.textContent = { off: "", idle: "☁ 동기화됨", busy: "☁ 동기화 중…", error: "☁ 동기화 오류", offline: "☁ 오프라인" }[state];
      el.className = "syncdot " + state + (state === "off" ? " hidden" : "");
      el.title = state === "error" ? err : at ? "마지막 동기화 " + new Date(at).toLocaleTimeString() : "";
    }
    function set(s, e) {
      state = s; err = e || ""; show();
      if (location.hash === "#/settings") viewSettings();
    }

    // 원격을 읽어 합치고, 이 기기에 새 기록이 있으면 올린다. 원격에서 새로 받은 게 있으면 true
    function now() {
      if (!conf || !conf.gist) return Promise.resolve(false);
      if (busy) { again = true; return Promise.resolve(false); }
      if (!navigator.onLine) { set("offline"); return Promise.resolve(false); }
      busy = true; set("busy");
      var wasDirty = dirty; dirty = false;
      var before = dump(), gotNew = false;
      return api("/gists/" + conf.gist).then(function (g) {
        var f = g.files && g.files[FILE];
        var remote = f && f.content ? f.content : "";
        if (remote) merge(store, JSON.parse(remote));
        saveLocal();
        gotNew = dump() !== before;
        if (wasDirty || dump() !== remote) {
          var files = {}; files[FILE] = { content: dump() };
          return api("/gists/" + conf.gist, "PATCH", { files: files });
        }
      }).then(function () {
        at = Date.now(); busy = false; set("idle");
        if (again) { again = false; now(); }
        return gotNew;
      }).catch(function (e) {
        busy = false; dirty = dirty || wasDirty; set("error", e.message);
        return false;
      });
    }
    function changed() {
      if (!conf) return;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(now, 2000);
    }
    function connect(token) {
      conf = { token: token.trim() };
      state = "busy"; show();
      return api("/gists?per_page=100").then(function (list) {
        var hit = list.filter(function (g) { return g.files && g.files[FILE]; })[0];
        if (hit) return hit.id;
        var files = {}; files[FILE] = { content: dump() };
        return api("/gists", "POST", { description: "의대 OX 퀴즈 기록 (자동 동기화)", public: false, files: files }).then(function (g) { return g.id; });
      }).then(function (id) {
        conf.gist = id;
        try { localStorage.setItem(CONF, JSON.stringify(conf)); } catch (e) {}
        dirty = true;
        return now();
      }).catch(function (e) { conf = null; state = "off"; show(); throw e; });
    }
    function disconnect() {
      conf = null;
      try { localStorage.removeItem(CONF); } catch (e) {}
      set("off");
    }
    // 다른 기기에서 푼 걸 가져오도록: 다시 볼 때 당겨오고, 떠날 때 올린다
    document.addEventListener("visibilitychange", function () {
      if (!conf) return;
      if (document.visibilityState === "visible") now().then(function (n) { if (n) refresh(); });
      else if (dirty) { clearTimeout(timer); now(); }
    });
    window.addEventListener("online", function () { if (conf) now(); });
    return {
      on: function () { return !!conf; }, state: function () { return state; }, err: function () { return err; }, at: function () { return at; },
      now: now, changed: changed, connect: connect, disconnect: disconnect, show: show
    };
  })();

  // ── 등록 · 부팅 ────────────────────────────────────
  function register(set) {
    set.topicMap = {};
    set.topics.forEach(function (t) { set.topicMap[t.id] = t; });
    if (!SETS[set.id]) ORDER.push(set.id);
    SETS[set.id] = set;
  }

  function boot() {
    var files = window.SET_FILES || [];
    var i = 0;
    (function next() {
      if (i >= files.length) {
        window.addEventListener("hashchange", route);
        route();
        Sync.show();
        Sync.now().then(function (n) { if (n) refresh(); });
        return;
      }
      var s = document.createElement("script");
      s.src = files[i++];
      s.onload = next;
      s.onerror = function () { console.warn("세트 파일을 못 읽음:", s.src); next(); };
      document.body.appendChild(s);
    })();
  }
  // 풀이 중이 아닐 때만 다시 그린다 (동기화로 기록이 바뀌었을 때)
  function refresh() {
    var h = location.hash;
    if (h.indexOf("#/quiz") === 0 || h.indexOf("#/settings") === 0) return;
    var y = window.scrollY;
    route();
    window.scrollTo(0, y);
  }

  // ── 유틸 ──────────────────────────────────────────
  var app = function () { return document.getElementById("app"); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function srcLabel(set, t) {
    if (!t) return "";
    if (t.memo) return "시험정보";
    var m = /^(P\d+)\s*(\d+p)?/.exec(t.src || "");
    if (m && set.lectures[m[1]]) return set.lectures[m[1]].split("·")[0].trim() + (m[2] ? " " + m[2] : "");
    return t.src || "";
  }
  function stats(set, qs) {
    qs = qs || set.questions;
    var st = { total: qs.length, seen: 0, ok: 0, ng: 0, due: 0, lv: [0, 0, 0, 0, 0] };
    qs.forEach(function (q) {
      var r = rec(set.id, q.id);
      st.lv[level(r)]++;
      if (!r) return;
      st.seen++;
      if (r.l) st.ok++; else st.ng++;
      if (isDue(set.id, q.id)) st.due++;
    });
    return st;
  }
  function lvBar(st) {
    return '<div class="bar lvbar">' + [4, 3, 2, 1].map(function (i) {
      return '<i class="' + LEVELS[i].cls + '" style="width:' + pct(st.lv[i], st.total) + '%"></i>';
    }).join("") + "</div>";
  }
  function lvLegend(st) {
    return '<div class="legend">' + [4, 3, 2, 1, 0].map(function (i) {
      return '<span><i class="' + LEVELS[i].cls + '"></i>' + LEVELS[i].name + " <b>" + st.lv[i] + "</b></span>";
    }).join("") + "</div>";
  }
  function setNav(which) {
    document.querySelectorAll(".navlink").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("href") === "#/" + which);
    });
  }
  function dueItems(sets) {
    var out = [];
    sets.forEach(function (set) {
      set.questions.forEach(function (q) { if (isDue(set.id, q.id)) out.push({ set: set, q: q }); });
    });
    // 다시 익히는 중(0단계)부터, 그 안에서는 섞기
    shuffle(out);
    out.sort(function (a, b) { return (rec(a.set.id, a.q.id).b || 0) - (rec(b.set.id, b.q.id).b || 0); });
    return out;
  }
  function upcoming(sets) {
    var t = today(), next = null, n = 0;
    sets.forEach(function (set) {
      set.questions.forEach(function (q) {
        var r = rec(set.id, q.id);
        if (!r || r.d == null || r.d <= t) return;
        if (next === null || r.d < next) { next = r.d; n = 1; } else if (r.d === next) n++;
      });
    });
    return next === null ? null : { days: next - t, n: n };
  }
  function dday(set) {
    var ex = examDay(set);
    if (ex == null) return "";
    var n = ex - today();
    return n > 0 ? "시험 D-" + n : n === 0 ? "시험 D-day" : "";
  }

  // ── 라우팅 ────────────────────────────────────────
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    document.onkeydown = null;
    window.scrollTo(0, 0);
    setNav(parts[0]);
    if (parts[0] === "set" && SETS[decodeURIComponent(parts[1])]) return viewSet(SETS[decodeURIComponent(parts[1])]);
    if (parts[0] === "quiz" && session) return viewQuiz();
    if (parts[0] === "result" && session) return viewResult();
    if (parts[0] === "wrong") return viewWrong();
    if (parts[0] === "settings") return viewSettings();
    viewHome();
  }

  // ── 홈 ────────────────────────────────────────────
  function reviewCard(sets, back, title) {
    var due = dueItems(sets);
    if (due.length) {
      return '<div class="card review"><div><div class="rv-n">' + due.length + '<small>문제</small></div><p>오늘 복습할 차례예요. 틀렸던 것부터 나와요.</p></div>' +
        '<button class="btn primary" data-review="' + esc(back) + '">오늘 복습 시작</button></div>';
    }
    var up = upcoming(sets);
    var any = sets.some(function (s) { return stats(s).seen; });
    if (!any) return "";
    return '<div class="card review done"><p>오늘 복습은 끝났어요.' + (up ? " 다음 복습: <b>" + dLabel(up.days) + " " + up.n + "문제</b>" : "") + "</p></div>";
  }
  function bindReview(sets, back, title) {
    var b = document.querySelector("[data-review]");
    if (b) b.onclick = function () { start(dueItems(sets), "instant", back, title, true); };
  }

  function viewHome() {
    document.title = "의대 OX 퀴즈";
    var all = ORDER.map(function (id) { return SETS[id]; });
    var html = '<h1>강조된 것만, OX로.</h1><p class="sub">교수님이 짚어 준 범위만 골라 만든 OX 퀴즈. 맞히면 복습 간격이 늘고, 틀리거나 모르면 다시 돌아옵니다.</p>';
    html += '<div style="margin-top:18px">' + reviewCard(all, "#/", "오늘 복습") + "</div>";

    var groups = {};
    var gorder = [];
    all.forEach(function (s) {
      var g = s.subject + "|" + (s.term || "");
      if (!groups[g]) { groups[g] = []; gorder.push(g); }
      groups[g].push(s);
    });
    if (!gorder.length) html += '<p class="empty">아직 세트가 없어요.</p>';
    gorder.forEach(function (g) {
      var p = g.split("|");
      html += '<div class="subject-h"><h2>' + esc(p[0]) + '</h2><span class="meta">' + esc(p[1]) + '</span></div><div class="stack">';
      groups[g].sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).forEach(function (s) {
        var st = stats(s);
        var dd = dday(s);
        html += '<a class="card setcard" href="#/set/' + encodeURIComponent(s.id) + '">' +
          '<div class="row"><h3>' + esc(s.title) + '</h3><span class="prof">' + esc(s.professor) + '</span></div>' +
          '<div class="meta">' + esc(s.date || "") + (s.slot ? " · " + esc(s.slot) : "") + ' · ' + s.questions.length + '문항' + (dd ? ' · <b class="dd">' + dd + "</b>" : "") + '</div>' +
          '<div style="margin-top:10px">' + lvBar(st) + '</div>' +
          '<div class="statline"><span>완벽 <b>' + st.lv[4] + '</b></span><span>익숙 <b>' + st.lv[3] + '</b></span><span>새 문제 <b>' + st.lv[0] + '</b></span>' +
          (st.due ? '<span class="duepill">오늘 복습 ' + st.due + "</span>" : "") + "</div></a>";
      });
      html += "</div>";
    });
    app().innerHTML = html;
    bindReview(all, "#/", "오늘 복습");
  }

  // ── 세트 화면 ─────────────────────────────────────
  function getOpts(set) {
    if (!setOpts[set.id]) setOpts[set.id] = { topics: set.topics.map(function (t) { return t.id; }), filter: "all", order: "seq", grade: "instant" };
    return setOpts[set.id];
  }
  function pickQuestions(set, o) {
    return set.questions.filter(function (q) {
      if (o.topics.indexOf(q.t) < 0) return false;
      var r = rec(set.id, q.id);
      if (o.filter === "unseen") return !r;
      if (o.filter === "due") return isDue(set.id, q.id);
      if (o.filter === "weak") return r && level(r) <= 2;
      if (o.filter === "star") return isStar(set.id, q.id);
      return true;
    });
  }

  function viewSet(set) {
    document.title = set.professor + " · " + set.title + " — 의대 OX";
    store.last = set.id; saveLocal();
    var o = getOpts(set);
    var st = stats(set);
    var dd = dday(set);

    var html = '<a class="crumb" href="#/">← 전체 세트</a>' +
      '<h1>' + esc(set.title) + '</h1>' +
      '<p class="sub">' + esc(set.subject) + ' · ' + esc(set.professor) + ' 교수님 · ' + esc(set.date || "") + (set.slot ? " " + esc(set.slot) : "") + (dd ? ' · <b class="dd">' + dd + "</b>" : "") + '</p>' +
      '<div class="card" style="margin-top:16px">' + lvBar(st) + lvLegend(st) + "</div>" +
      '<div style="margin-top:10px">' + reviewCard([set], "#/set/" + encodeURIComponent(set.id), set.title) + "</div>";

    html += '<h2>강조 범위</h2><div class="card"><ul class="focus">';
    set.focus.forEach(function (f) {
      var where = f.memo ? "시험정보" : (set.lectures[f.lec] || f.lec).split("·")[0].trim() + " " + f.page + "p";
      html += '<li><span class="where' + (f.memo ? " memo" : "") + '">' + esc(where) + '</span><span>' + esc(f.label) + '</span></li>';
    });
    html += '</ul>' + (set.examInfo ? '<div class="examinfo">' + esc(set.examInfo) + '</div>' : "") + '</div>';

    html += '<h2>핵심 정리 <span class="meta">— 풀기 전에 한 번 훑기</span></h2>';
    set.topics.forEach(function (t) {
      var ts = stats(set, set.questions.filter(function (q) { return q.t === t.id; }));
      html += '<details class="sum"><summary><b>' + esc(t.name) + '</b> <span class="pill ' + (t.memo ? "memo" : "src") + '">' + esc(srcLabel(set, t)) + '</span>' +
        '<span class="acc">' + (ts.seen ? "완벽 " + ts.lv[4] + "/" + ts.total : ts.total + "문항") + '</span></summary><ul>' +
        t.summary.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></details>";
    });

    html += '<h2>골라서 풀기</h2><div class="card opts">' +
      '<div><span class="opt-label">주제 <button class="chip" id="allTopics" style="padding:2px 10px;font-size:12px;margin-left:6px">전체 선택/해제</button></span><div class="chips" id="topicChips">' +
      set.topics.map(function (t) {
        var n = set.questions.filter(function (q) { return q.t === t.id; }).length;
        return '<button class="chip" data-t="' + esc(t.id) + '" aria-pressed="' + (o.topics.indexOf(t.id) >= 0) + '">' + esc(t.name) + ' <span class="n">' + n + '</span></button>';
      }).join("") + '</div></div>' +
      seg("filter", "문항", [["all", "전체"], ["unseen", "안 푼 것"], ["due", "복습 차례"], ["weak", "약한 것"], ["star", "★ 별표"]], o.filter) +
      '<p class="note" style="margin:-6px 0 0">약한 것 = 아직 ‘익숙’ 단계에 못 간 문제 · 별표 = 내가 직접 ★ 찍은 문제</p>' +
      seg("order", "순서", [["seq", "강의 순서"], ["shuffle", "섞기"]], o.order) +
      seg("grade", "채점", [["instant", "바로 확인"], ["exam", "시험처럼 (끝나고 채점)"]], o.grade) +
      '</div>';

    html += '<div class="startbar"><button class="btn primary block" id="startBtn"></button></div>';
    app().innerHTML = html;
    bindReview([set], "#/set/" + encodeURIComponent(set.id), set.title);

    function refreshBtn() {
      var n = pickQuestions(set, o).length;
      var b = document.getElementById("startBtn");
      b.textContent = n ? n + "문제 풀기" : "고른 조건에 맞는 문제가 없어요";
      b.disabled = !n;
    }
    document.getElementById("topicChips").onclick = function (e) {
      var c = e.target.closest(".chip"); if (!c) return;
      var id = c.dataset.t, i = o.topics.indexOf(id);
      if (i >= 0) o.topics.splice(i, 1); else o.topics.push(id);
      c.setAttribute("aria-pressed", i < 0);
      refreshBtn();
    };
    document.getElementById("allTopics").onclick = function () {
      o.topics = o.topics.length === set.topics.length ? [] : set.topics.map(function (t) { return t.id; });
      document.querySelectorAll("#topicChips .chip").forEach(function (c) { c.setAttribute("aria-pressed", o.topics.indexOf(c.dataset.t) >= 0); });
      refreshBtn();
    };
    document.querySelectorAll(".opts .seg").forEach(function (g) {
      g.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        o[g.dataset.k] = b.dataset.v;
        g.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        refreshBtn();
      };
    });
    document.getElementById("startBtn").onclick = function () {
      var qs = pickQuestions(set, o);
      if (o.order === "shuffle") qs = shuffle(qs.slice());
      start(qs.map(function (q) { return { set: set, q: q }; }), o.grade, "#/set/" + encodeURIComponent(set.id), set.title, o.filter === "due");
    };
    refreshBtn();
  }
  function seg(k, label, items, cur) {
    return '<div><span class="opt-label">' + label + '</span><div class="seg" data-k="' + k + '">' +
      items.map(function (it) { return '<button data-v="' + it[0] + '" aria-pressed="' + (it[0] === cur) + '">' + it[1] + "</button>"; }).join("") +
      "</div></div>";
  }

  // ── 풀이 ──────────────────────────────────────────
  // review: 복습 세션이면 틀리거나 모른 문제를 세션 끝에 한 번 더 낸다
  function start(items, grade, back, title, review) {
    if (!items.length) return;
    session = { items: items, i: 0, ans: new Array(items.length), grade: grade, back: back, title: title, review: !!review, again: {}, done: false };
    location.hash = "#/quiz";
    if (location.hash === "#/quiz") route();
  }
  function ansLabel(v) { return v === "?" ? "모름" : v ? "O" : "X"; }

  function viewQuiz() {
    var S = session;
    if (S.done) { location.hash = "#/result"; return; }
    var it = S.items[S.i];
    var set = it.set, q = it.q, t = set.topicMap[q.t];
    var picked = S.ans[S.i];
    var revealed = S.grade === "instant" && picked !== undefined;
    var answered = S.ans.filter(function (a) { return a !== undefined; }).length;
    var r = rec(set.id, q.id);
    document.title = (S.i + 1) + "/" + S.items.length + " — 의대 OX";

    var html = '<div class="qtop"><a class="iconbtn" href="' + S.back + '" title="그만 풀기 (Esc)" aria-label="그만 풀기">✕</a>' +
      '<div class="bar"><i class="ok" style="width:' + pct(S.grade === "exam" ? answered : S.i + (revealed ? 1 : 0), S.items.length) + '%"></i></div>' +
      '<span class="count">' + (S.i + 1) + " / " + S.items.length + '</span>' +
      '<button class="iconbtn" id="starBtn" aria-pressed="' + isStar(set.id, q.id) + '" title="별표 — 헷갈려서 다시 볼 문제 표시 (S)" aria-label="별표">★</button></div>';

    var mixed = S.items.some(function (x) { return x.set !== set; });
    html += '<div class="card qcard"><div class="qmeta">' +
      '<span class="pill ' + (t && t.memo ? "memo" : "src") + '">' + esc(t ? t.name : "") + '</span>' +
      '<span class="pill">' + esc(srcLabel(set, t)) + '</span>' +
      (mixed ? '<span class="pill">' + esc(set.professor) + '</span>' : "") +
      (S.again[S.i] ? '<span class="pill memo">한 번 더</span>' : "") +
      (revealed && q.ex ? '<span class="pill ex">기출 ' + esc(q.ex) + '</span>' : "") +
      '</div><p class="qtext">' + esc(q.q) + '</p></div>';

    var cls = function (v) {
      var c = "oxbtn " + (v ? "o" : "x");
      if (revealed) { if (v === q.a) c += " right"; else if (v === picked) c += " wrong"; }
      else if (picked === v) c += " pick";
      return c;
    };
    html += '<div class="ox">' +
      '<button class="' + cls(true) + '" data-v="1"' + (revealed ? " disabled" : "") + ' aria-label="O, 맞다">O</button>' +
      '<button class="' + cls(false) + '" data-v="0"' + (revealed ? " disabled" : "") + ' aria-label="X, 틀리다">X</button>' +
      '<button class="idk' + (picked === "?" ? " pick" : "") + '" data-v="?"' + (revealed ? " disabled" : "") + '>모르겠다</button></div>';

    if (revealed) {
      var ok = picked === q.a;
      var head = ok ? "정답" : picked === "?" ? "모름" : "오답";
      var nr = rec(set.id, q.id);
      var nextTxt = nr && nr.d != null ? (nr.d <= today() ? (S.review ? "이번 복습 끝에 한 번 더 나와요" : "오늘 복습에 다시 나와요") : "다음 복습 " + dLabel(nr.d - today())) : "";
      html += '<div class="verdict ' + (ok ? "ok" : "ng") + '"><div class="head">' + head + ' · 답은 ' + (q.a ? "O" : "X") +
        (nextTxt ? '<span class="nextrv">' + nextTxt + "</span>" : "") + '</div>' +
        (q.why ? "<p>" + esc(q.why) + "</p>" : "") + "</div>";
      html += '<div class="qnav"><button class="btn primary" id="nextBtn">' + (S.i + 1 < S.items.length ? "다음 →" : "결과 보기") + "</button></div>";
    } else if (r && S.grade === "instant") {
      html += '<p class="note" style="text-align:center;margin-top:10px">' + LEVELS[level(r)].name + " · 맞음 " + r.c + " · 틀림 " + r.w + (r.u ? " · 모름 " + r.u : "") + "</p>";
    }
    if (S.grade === "exam") {
      html += '<div class="qnav"><button class="btn ghost" id="prevBtn"' + (S.i ? "" : " disabled") + '>← 이전</button>' +
        (S.i + 1 < S.items.length ? '<button class="btn ghost" id="skipBtn">다음 →</button>' : "") +
        '<button class="btn primary" id="submitBtn">채점하기 (' + answered + "/" + S.items.length + ")</button></div>";
      html += '<div class="dots">' + S.items.map(function (_, k) {
        return '<button data-k="' + k + '" class="' + (S.ans[k] !== undefined ? "done " : "") + (k === S.i ? "cur" : "") + '">' + (k + 1) + "</button>";
      }).join("") + "</div>";
    }
    html += '<p class="kbd"><kbd>O</kbd>·<kbd>1</kbd> 맞다 &nbsp; <kbd>X</kbd>·<kbd>2</kbd> 틀리다 &nbsp; <kbd>↓</kbd>·<kbd>3</kbd> 모르겠다 &nbsp; <kbd>→</kbd> 다음' + (S.grade === "exam" ? " · <kbd>←</kbd> 이전" : "") + ' &nbsp; <kbd>S</kbd> 별표</p>';
    app().innerHTML = html;

    function answer(v) {
      if (revealed) return;
      S.ans[S.i] = v;
      if (S.grade === "instant") {
        var ok = v === q.a;
        record(set, q.id, ok ? true : v === "?" ? "?" : false); save();
        var key = set.id + ":" + q.id;
        if (S.review && !ok && !S.againDone) S.againDone = {};
        if (S.review && !ok && !S.againDone[key]) {
          S.againDone[key] = 1;
          S.items.push(it); S.ans.push(undefined); S.again[S.items.length - 1] = 1;
        }
        viewQuiz();
      } else {
        if (S.i + 1 < S.items.length) S.i++;
        viewQuiz();
      }
    }
    function next() {
      if (S.grade === "instant" && !revealed) return;
      if (S.i + 1 < S.items.length) { S.i++; viewQuiz(); window.scrollTo(0, 0); }
      else finish();
    }
    document.querySelectorAll(".ox button").forEach(function (b) {
      b.onclick = function () { answer(b.dataset.v === "?" ? "?" : b.dataset.v === "1"); };
    });
    var nb = document.getElementById("nextBtn"); if (nb) { nb.onclick = next; nb.focus({ preventScroll: true }); }
    document.getElementById("starBtn").onclick = function () { toggleStar(set.id, q.id); this.setAttribute("aria-pressed", isStar(set.id, q.id)); };
    var pb = document.getElementById("prevBtn"); if (pb) pb.onclick = function () { S.i--; viewQuiz(); };
    var sk = document.getElementById("skipBtn"); if (sk) sk.onclick = function () { S.i++; viewQuiz(); };
    var sb = document.getElementById("submitBtn");
    if (sb) sb.onclick = function () {
      var left = S.items.length - answered;
      if (left && !confirm(left + "문제를 안 풀었어요. 그래도 채점할까요? (안 푼 문제는 기록에 남지 않아요)")) return;
      S.items.forEach(function (x, k) {
        var a = S.ans[k];
        if (a !== undefined) record(x.set, x.q.id, a === x.q.a ? true : a === "?" ? "?" : false);
      });
      save(); finish();
    };
    document.querySelectorAll(".dots button").forEach(function (b) { b.onclick = function () { S.i = +b.dataset.k; viewQuiz(); }; });

    document.onkeydown = function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var c = e.code;
      if (c === "KeyO" || c === "Digit1" || c === "Numpad1") { e.preventDefault(); answer(true); }
      else if (c === "KeyX" || c === "Digit2" || c === "Numpad2") { e.preventDefault(); answer(false); }
      else if (c === "ArrowDown" || c === "Slash" || c === "Digit3" || c === "Numpad3") { e.preventDefault(); answer("?"); }
      else if (c === "ArrowRight" || c === "Enter" || c === "Space") {
        if (revealed) { e.preventDefault(); next(); }
        else if (S.grade === "exam" && S.i + 1 < S.items.length) { e.preventDefault(); S.i++; viewQuiz(); }
      }
      else if (c === "ArrowLeft" && S.grade === "exam" && S.i) { e.preventDefault(); S.i--; viewQuiz(); }
      else if (c === "KeyS") { document.getElementById("starBtn").click(); }
      else if (c === "Escape") { location.hash = S.back; }
    };
  }

  function finish() {
    session.done = true;
    Sync.now();
    location.hash = "#/result";
  }

  // ── 결과 ──────────────────────────────────────────
  function viewResult() {
    var S = session;
    document.title = "결과 — 의대 OX";
    var tot = 0, ok = 0, unk = 0, byT = {}, wrong = [], seen = {};
    S.items.forEach(function (x, k) {
      var a = S.ans[k];
      if (a === undefined || S.again[k]) return; // 점수는 첫 시도만
      tot++;
      var key = x.set.id + "|" + x.q.t;
      byT[key] = byT[key] || { name: x.set.topicMap[x.q.t].name, ok: 0, n: 0 };
      byT[key].n++;
      if (a === x.q.a) { ok++; byT[key].ok++; }
      else {
        if (a === "?") unk++;
        if (!seen[x.set.id + ":" + x.q.id]) { seen[x.set.id + ":" + x.q.id] = 1; wrong.push({ x: x, a: a }); }
      }
    });
    var p = pct(ok, tot);
    var up = upcoming(ORDER.map(function (id) { return SETS[id]; }));
    var html = '<a class="crumb" href="' + S.back + '">← ' + esc(S.title) + '</a><h1>결과</h1>' +
      '<div class="card score" style="margin-top:12px"><div class="ring" style="--p:' + p + '"><span>' + p + '%</span></div>' +
      '<div><div style="font-size:18px;font-weight:700">' + ok + " / " + tot + ' 맞음</div><p class="sub">' +
      (unk ? "모름 " + unk + "문제 · " : "") +
      (wrong.length ? "틀리거나 모른 " + wrong.length + "문제는 복습 단계가 처음으로 돌아갔어요." : "전부 맞혔어요!") +
      (up ? "<br>다음 복습: " + dLabel(up.days) + " " + up.n + "문제" : "") + "</p></div></div>";

    var keys = Object.keys(byT);
    if (keys.length > 1) {
      html += '<h2>주제별</h2><div class="card tstat">';
      keys.sort(function (a, b) { return byT[a].ok / byT[a].n - byT[b].ok / byT[b].n; }).forEach(function (k) {
        var b = byT[k];
        html += "<span>" + esc(b.name) + '</span><span class="meta">' + b.ok + "/" + b.n + "</span>" +
          '<div class="bar thin"><i class="ok" style="width:' + pct(b.ok, b.n) + '%"></i><i class="ng" style="width:' + (100 - pct(b.ok, b.n)) + '%"></i></div>';
      });
      html += "</div>";
    }

    html += '<div class="btnrow" style="margin-top:18px">' +
      (wrong.length ? '<button class="btn primary" id="retryWrong">틀린·모른 ' + wrong.length + "문제 다시</button>" : "") +
      '<button class="btn" id="retryAll">처음부터 다시</button><a class="btn ghost" href="' + S.back + '" style="text-decoration:none">돌아가기</a></div>';

    if (wrong.length) {
      html += '<h2>틀리거나 모른 문제</h2><div class="wlist">' + wrong.map(function (w) { return witem(w.x.set, w.x.q, w.a); }).join("") + "</div>";
    }
    app().innerHTML = html;
    var rw = document.getElementById("retryWrong");
    if (rw) rw.onclick = function () { start(wrong.map(function (w) { return w.x; }), S.grade, S.back, S.title); };
    var firsts = S.items.filter(function (_, k) { return !S.again[k]; });
    document.getElementById("retryAll").onclick = function () { start(firsts, S.grade, S.back, S.title); };
  }

  function witem(set, q, picked) {
    var t = set.topicMap[q.t];
    return '<div class="card witem"><div class="qmeta"><span class="pill src">' + esc(t.name) + '</span><span class="pill">' + esc(srcLabel(set, t)) + "</span>" +
      (q.ex ? '<span class="pill ex">기출 ' + esc(q.ex) + "</span>" : "") + "</div>" +
      '<p class="q">' + esc(q.q) + "</p>" +
      '<div class="ans">정답 <b class="' + (q.a ? "o" : "x") + '">' + (q.a ? "O" : "X") + "</b>" +
      (picked !== undefined ? ' · 내 답 <b class="' + (picked === "?" ? "" : picked ? "o" : "x") + '">' + ansLabel(picked) + "</b>" : "") + "</div>" +
      (q.why ? '<p class="why">' + esc(q.why) + "</p>" : "") + "</div>";
  }

  // ── 오답노트 ──────────────────────────────────────
  function viewWrong() {
    document.title = "오답노트 — 의대 OX";
    var wrong = [], stars = [];
    ORDER.forEach(function (id) {
      var set = SETS[id];
      set.questions.forEach(function (q) {
        var r = rec(id, q.id);
        if (r && r.l === 0) wrong.push({ set: set, q: q, r: r });
        if (isStar(id, q.id)) stars.push({ set: set, q: q });
      });
    });
    wrong.sort(function (a, b) { return (b.r.w + (b.r.u || 0)) - (a.r.w + (a.r.u || 0)) || b.r.t - a.r.t; });
    var html = '<h1>오답노트</h1><p class="sub">마지막으로 풀었을 때 틀렸거나 ‘모르겠다’ 한 문제예요. 다시 맞히면 빠져요.<br>★ 별표는 헷갈려서 다시 보고 싶은 문제에 직접 찍는 표시로, 맞혀도 안 빠지고 내가 끌 때까지 남아요.</p>';
    html += '<div class="btnrow" style="margin-top:14px">' +
      '<button class="btn primary" id="doWrong"' + (wrong.length ? "" : " disabled") + ">오답 " + wrong.length + "문제 섞어서 풀기</button>" +
      '<button class="btn" id="doStar"' + (stars.length ? "" : " disabled") + ">★ 별표 " + stars.length + "문제 풀기</button></div>";
    if (!wrong.length) html += '<p class="empty">지금 틀린 상태인 문제가 없어요.</p>';
    else html += '<h2>틀린 문제 <span class="meta">많이 틀린 순</span></h2><div class="wlist">' + wrong.map(function (w) {
      return witem(w.set, w.q).replace('<p class="q">', '<p class="meta" style="margin:6px 0 0">' + esc(w.set.professor) + " · 틀림 " + w.r.w + "회" + (w.r.u ? " · 모름 " + w.r.u + "회" : "") + " · 맞음 " + w.r.c + '회</p><p class="q">');
    }).join("") + "</div>";
    app().innerHTML = html;
    var mk = function (arr) { return shuffle(arr.map(function (w) { return { set: w.set, q: w.q }; })); };
    document.getElementById("doWrong").onclick = function () { start(mk(wrong), "instant", "#/wrong", "오답노트", true); };
    document.getElementById("doStar").onclick = function () { start(mk(stars), "instant", "#/wrong", "오답노트"); };
  }

  // ── 설정 ──────────────────────────────────────────
  function viewSettings() {
    document.title = "설정 — 의대 OX";
    var th = document.documentElement.dataset.theme || "auto";
    var n = Object.keys(store.r).length;
    var html = '<h1>설정</h1>';

    html += '<h2>기기 간 동기화</h2><div class="card">';
    if (Sync.on()) {
      var s = Sync.state();
      html += '<p style="margin-top:0"><b>' + { idle: "켜짐 · 모든 기기가 같은 기록을 씁니다", busy: "동기화 중…", error: "오류: " + esc(Sync.err()), offline: "오프라인 · 연결되면 자동으로 맞춰요" }[s] + "</b>" +
        (Sync.at() ? '<br><span class="note">마지막 동기화 ' + new Date(Sync.at()).toLocaleString() + "</span>" : "") + "</p>" +
        '<p class="note">문제를 풀면 2초 뒤 자동으로 올리고, 앱을 다시 열거나 탭으로 돌아오면 다른 기기 기록을 받아 옵니다. 기록은 내 GitHub의 비밀 gist(med-ox-quiz-progress.json)에 저장돼요.</p>' +
        '<div class="btnrow"><button class="btn primary" id="syncNow">지금 동기화</button><button class="btn ghost" id="syncOff">이 기기 연결 끊기</button></div>';
    } else {
      html += '<p style="margin-top:0">기록을 내 GitHub 계정의 <b>비밀 gist</b>에 저장해서 폰·노트북·태블릿이 같은 기록을 쓰게 합니다. 기기마다 한 번만 하면 돼요.</p>' +
        '<ol class="steps"><li><a href="https://github.com/settings/tokens/new?scopes=gist&description=med-ox-quiz" target="_blank" rel="noopener">GitHub 토큰 만들기</a>를 연다 (gist 권한만 체크된 상태로 열림)</li>' +
        "<li>Expiration을 <b>No expiration</b>(또는 1년)으로 바꾸고 맨 아래 <b>Generate token</b></li>" +
        "<li>나온 토큰(ghp_…)을 복사해 아래에 붙여넣고 연결 — 다른 기기에서도 같은 토큰을 쓰면 됩니다 (메모 앱 등에 보관)</li></ol>" +
        '<div class="tokenrow"><input id="tok" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_로 시작하는 토큰"><button class="btn primary" id="syncOn">연결</button></div>' +
        '<p class="note" id="syncMsg">토큰은 이 기기 브라우저에만 저장되고 GitHub 말고 다른 곳으로는 보내지 않아요. gist 권한만 있어서 저장소는 건드릴 수 없습니다.</p>';
    }
    html += "</div>";

    html += '<h2>화면</h2><div class="card">' + seg("theme", "테마", [["auto", "기기 설정 따름"], ["light", "밝게"], ["dark", "어둡게"]], th) + "</div>" +
      '<h2>백업</h2><div class="card"><p class="note" style="margin-top:0">기록 파일로 내보내기·불러오기 (동기화와 별개, 지금 기록 ' + n + "문항)</p>" +
      '<div class="btnrow"><button class="btn" id="exp">내보내기 (.json)</button><button class="btn" id="imp">불러오기</button><input type="file" id="impFile" accept=".json,application/json" class="hidden"></div></div>' +
      '<h2>초기화</h2><div class="card"><p class="note" style="margin-top:0">동기화가 켜져 있으면 모든 기기에서 같이 지워져요.</p><div class="btnrow">' +
      ORDER.map(function (id) { return '<button class="btn ghost" data-reset="' + esc(id) + '">' + esc(SETS[id].professor + " · " + SETS[id].title) + " 기록 지우기</button>"; }).join("") +
      '<button class="btn danger" data-reset="*">전체 기록·별표 지우기</button></div></div>' +
      '<h2>복습 규칙</h2><div class="card note">맞히면 다음 복습이 1 → 3 → 7 → 14 → 30 → 60일 뒤로 늘어나고, 틀리거나 ‘모르겠다’ 하면 처음 단계로 돌아가 오늘 다시 나옵니다. 세트에 시험일이 있으면 시험 전날을 넘겨 미루지 않아요. 단계: 다시 익히는 중(0) · 학습 중(1–2) · 익숙(3–4) · 완벽(5+).</div>';
    app().innerHTML = html;

    var on = document.getElementById("syncOn");
    if (on) on.onclick = function () {
      var v = document.getElementById("tok").value;
      if (!v.trim()) return;
      on.disabled = true;
      document.getElementById("syncMsg").textContent = "연결 중…";
      Sync.connect(v).then(function () { viewSettings(); }).catch(function (e) {
        on.disabled = false;
        document.getElementById("syncMsg").textContent = "연결 실패: " + e.message;
      });
    };
    var sn = document.getElementById("syncNow"); if (sn) sn.onclick = function () { Sync.now(); };
    var so = document.getElementById("syncOff");
    if (so) so.onclick = function () { if (confirm("이 기기만 연결을 끊을까요? (기록은 남아요)")) Sync.disconnect(); };

    document.querySelector('.seg[data-k="theme"]').onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var v = b.dataset.v;
      if (v === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
      try { if (v === "auto") localStorage.removeItem("mox:theme"); else localStorage.setItem("mox:theme", v); } catch (err) {}
      this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    };
    document.getElementById("exp").onclick = function () {
      var blob = new Blob([JSON.stringify(store)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ox-quiz-기록-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    var f = document.getElementById("impFile");
    document.getElementById("imp").onclick = function () { f.click(); };
    f.onchange = function () {
      var file = f.files[0]; if (!file) return;
      file.text().then(function (txt) {
        var d = JSON.parse(txt);
        if (!d || typeof d.r !== "object") throw new Error("형식");
        merge(store, d);
        save(); alert("불러왔어요."); viewSettings();
      }).catch(function () { alert("이 파일은 퀴즈 기록 파일이 아니에요."); });
    };
    document.querySelectorAll("[data-reset]").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.reset;
        if (!confirm(id === "*" ? "모든 기록과 별표를 지울까요?" : "이 세트의 기록과 별표를 지울까요?")) return;
        store.z[id] = Date.now();
        applyResets(store);
        if (id === "*" || store.last === id) store.last = null;
        save(); viewSettings();
      };
    });
  }

  window.QUIZ = { register: register, boot: boot };
})();
