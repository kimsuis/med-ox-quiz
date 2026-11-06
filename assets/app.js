/* 의대 OX 퀴즈 — 세트 파일(data/sets/*.js)이 QUIZ.register()로 문제를 등록한다.
   풀이 기록은 localStorage에 두고, 동기화를 켜면 내 GitHub 비밀 gist와 합쳐서 모든 기기가 같은 기록을 본다.
   합치는 규칙: 문항·별표마다 더 나중(t)에 바뀐 쪽이 이김, 초기화(z)는 그 시각 이전 기록을 지움.
   복습(안키 방식): 문항마다 간격(iv, 일)·쉬움 정도(ef)·다음 복습일(d, 날짜 번호).
   안다 → 간격 1→3→간격×ef / 모르겠다 → 간격×1.2(최소 1일)·ef↓ / 틀렸다 → 오늘 다시·ef↓. 시험 전날을 넘겨 미루지 않음. */
(function () {
  "use strict";

  var SETS = {};
  var ORDER = [];
  var KEY = "mox:v1";
  var INTERVAL = [0, 1, 3, 7, 14, 30, 60]; // 예전 단계(b) 기록을 간격으로 옮길 때만 씀
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
    backupDaily();
    Sync.changed();
  }
  // 하루 한 번 기록 스냅샷을 따로 남긴다 (최근 7일). 설정에서 되살릴 수 있음
  var BAK = "mox:bak:";
  function backups() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(BAK) === 0) out.push(k.slice(BAK.length)); }
    } catch (e) {}
    return out.sort().reverse();
  }
  function backupDaily() {
    var d = new Date(), k = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    if (!Object.keys(store.r).length) return;
    try {
      localStorage.setItem(BAK + k, JSON.stringify(store));
      backups().slice(7).forEach(function (old) { localStorage.removeItem(BAK + old); });
    } catch (e) {}
  }
  // 풀던 세션도 저장해 두었다가 이어 푼다 (새로고침·창 닫기에도 안 날아가게)
  var SESS = "mox:sess";
  function saveSession() {
    if (!session) return;
    try {
      if (session.done) { localStorage.removeItem(SESS); return; }
      var s = {};
      Object.keys(session).forEach(function (k) { if (k !== "items") s[k] = session[k]; });
      s.items = session.items.map(function (x) { return [x.set.id, x.q.id]; });
      s.t = Date.now();
      localStorage.setItem(SESS, JSON.stringify(s));
    } catch (e) {}
  }
  function findSet(sid) {
    if (SETS[sid]) return SETS[sid];
    if (sid.indexOf("g:") === 0) return G.get(sid.slice(2)) || null;
    return null;
  }
  function savedSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESS) || "null");
      if (!s || s.done) return null;
      var items = [];
      s.items.forEach(function (p) {
        var set = findSet(p[0]); if (!set) return;
        var q = set.questions.filter(function (x) { return x.id === p[1]; })[0];
        if (q) items.push({ set: set, q: q });
      });
      if (items.length !== s.items.length) return null;   // 기출이 아직 안 열렸으면 나중에
      s.items = items;
      return s;
    } catch (e) { return null; }
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
  function srs(r) {
    if (r.iv == null) r.iv = r.b != null ? INTERVAL[r.b] || 0 : (r.l ? 1 : 0);
    if (r.ef == null) r.ef = 2.5;
    return r;
  }
  function level(r) {
    if (!r) return 0;
    srs(r);
    if (r.l === 0 || r.iv === 0) return 1;
    return r.iv < 3 ? 2 : r.iv < 10 ? 3 : 4;
  }
  // res: "know" 안다 / "unsure" 모르겠다 / "wrong" 틀렸다 (true·"?"·false도 받음)
  function record(set, qid, res) {
    if (res === true) res = "know"; else if (res === "?") res = "unsure"; else if (res !== "know" && res !== "unsure") res = "wrong";
    var k = set.id + ":" + qid;
    var r = srs(store.r[k] ? JSON.parse(JSON.stringify(store.r[k])) : { c: 0, w: 0, u: 0 });
    if (res === "know") {
      r.c++;
      r.iv = r.iv < 1 ? 1 : r.iv < 3 ? 3 : Math.round(r.iv * r.ef);
    } else if (res === "unsure") {
      r.u = (r.u || 0) + 1; r.ef = Math.max(1.3, r.ef - 0.15);
      r.iv = Math.max(1, Math.round(r.iv * 1.2));
    } else {
      r.w++; r.ef = Math.max(1.3, r.ef - 0.2); r.iv = 0; r.lapse = (r.lapse || 0) + 1;
    }
    var due = today() + r.iv;
    var ex = examDay(set);
    // 시험 전이면 다음 복습이 시험 전날을 넘지 않게
    if (r.iv > 0 && ex != null && today() < ex - 1) due = Math.min(due, ex - 1);
    r.d = due; r.l = res === "know" ? 1 : 0; r.g = res; r.t = Date.now();
    delete r.b;
    store.r[k] = r;
  }
  function isStar(setId, qid) { var v = store.s[setId + ":" + qid]; return !!(v && v.on); }
  function toggleStar(setId, qid) {
    store.s[setId + ":" + qid] = { on: isStar(setId, qid) ? 0 : 1, t: Date.now() };
    save();
  }

  // ── 기기 간 동기화 (GitHub 비밀 gist) ──────────────
  var Sync = (function () {
    var CONF = "mox:sync", FILE = "med-ox-quiz-progress.json", KEYF = "med-ox-quiz-key.txt";
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
        // 기출 암호 키도 gist로 기기끼리 나눈다
        var kf = g.files && g.files[KEYF];
        var keyJob = kf && kf.content && !G.hasPass() ? G.setPass(kf.content.trim(), true).catch(function () {}) : null;
        var needKey = !kf && G.hasPass();
        if (wasDirty || dump() !== remote || needKey) {
          var files = {}; files[FILE] = { content: dump() };
          if (needKey) files[KEYF] = { content: G.pass() };
          return api("/gists/" + conf.gist, "PATCH", { files: files }).then(function () { return keyJob; });
        }
        return keyJob;
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

  // ── 기출 (암호화된 data/g) ─────────────────────────
  // 공개 저장소에는 암호문만 있다. 키 문구는 기기 localStorage와 내 비밀 gist에만.
  var G = (function () {
    var PK = "mox:gkey";
    var st = { state: "idle", err: "", meta: null, key: null, sets: [], byId: {}, ex: null, data: null };
    var pass = null;
    try { pass = localStorage.getItem(PK); } catch (e) {}
    var urls = {};

    function b64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
    function dec(key, buf) { var u = new Uint8Array(buf); return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, key, u.slice(12)); }
    function loadMeta() {
      if (st.meta) return Promise.resolve(st.meta);
      return fetch("data/g/meta.json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("none");
        return r.json();
      }).then(function (m) { st.meta = m; return m; });
    }
    function unlock(p) {
      return loadMeta().then(function () {
        return crypto.subtle.importKey("raw", new TextEncoder().encode(p), "PBKDF2", false, ["deriveKey"]);
      }).then(function (base) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(st.meta.salt), iterations: st.meta.iter, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      }).then(function (k) {
        return dec(k, b64(st.meta.check)).then(function () { return k; }, function () { throw new Error("키가 맞지 않아요"); });
      });
    }
    function build(d) {
      st.data = d; st.byId = {};
      st.sets = d.lectures.map(function (L) {
        L.questions.forEach(function (q) { q.id = q.k; });
        var s = { kind: "g", id: "g:" + L.id, lid: L.id, examDate: d.examDate, title: L.title, professor: L.prof, L: L, questions: L.questions };
        st.byId[L.id] = s;
        return s;
      });
      d.ex2025.forEach(function (q) { q.id = q.k; q.src = "2025 시험"; q.years = [2025]; });
      st.ex = { kind: "g", id: "g:EX2025", lid: "EX2025", examDate: d.examDate, title: "2025 실제 시험", professor: "",
        L: { id: "EX2025", title: "2025 내분비 1차 시험", cases: {}, questions: d.ex2025 }, questions: d.ex2025 };
      st.byId.EX2025 = st.ex;
    }
    function init() {
      if (!window.crypto || !crypto.subtle || !window.DecompressionStream) {
        st.state = "error"; st.err = "이 브라우저는 암호 해제를 지원하지 않아요 (최신 Chrome·Safari 사용)";
        return Promise.resolve();
      }
      if (!pass) return loadMeta().then(function () { st.state = "locked"; }, function () { st.state = "none"; });
      st.state = "loading";
      return unlock(pass).then(function (k) {
        st.key = k;
        return fetch("data/g/index.bin", { cache: "no-cache" }).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return dec(k, b); });
      }).then(function (plain) {
        return new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("deflate"))).text();
      }).then(function (txt) {
        build(JSON.parse(txt)); st.state = "ready";
      }).catch(function (e) {
        st.state = e.message === "none" ? "none" : "error"; st.err = e.message;
      });
    }
    function setPass(p, fromSync) {
      p = (p || "").trim();
      return unlock(p).then(function () {
        pass = p;
        try { localStorage.setItem(PK, p); } catch (e) {}
        if (!fromSync) Sync.changed();
        return init();
      }).then(function () { refresh(); });
    }
    function img(path) {
      if (urls[path]) return urls[path];
      urls[path] = fetch("data/g/" + path).then(function (r) { return r.arrayBuffer(); })
        .then(function (b) { return dec(st.key, b); })
        .then(function (plain) { return URL.createObjectURL(new Blob([plain], { type: "image/webp" })); });
      return urls[path];
    }
    // 화면에 들어올 때 그림을 풀어 넣는다
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } });
    }, { rootMargin: "600px" }) : null;
    function load(el) {
      img(el.dataset.g).then(function (u) { el.src = u; el.classList.add("on"); }, function () { el.alt = "그림을 못 불러옴"; });
    }
    function hydrate(root) {
      (root || document).querySelectorAll("img[data-g]:not(.on)").forEach(function (el) { if (io) io.observe(el); else load(el); });
    }
    return {
      init: init, setPass: setPass, hydrate: hydrate,
      hasPass: function () { return !!pass; }, pass: function () { return pass; },
      state: function () { return st.state; }, err: function () { return st.err; },
      sets: function () { return st.state === "ready" ? st.sets : []; },
      ex: function () { return st.state === "ready" ? st.ex : null; },
      get: function (lid) { return st.byId[lid]; }, data: function () { return st.data; },
      forget: function () { pass = null; try { localStorage.removeItem(PK); } catch (e) {} st.state = "locked"; st.sets = []; }
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
    if (isFit()) document.body.classList.add("fit");
    // 브라우저가 저장공간 정리할 때 이 사이트 기록은 지우지 말라고 요청
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    var files = window.SET_FILES || [];
    var i = 0;
    (function next() {
      if (i >= files.length) {
        window.addEventListener("hashchange", route);
        route();
        Sync.show();
        G.init().then(function () { refresh(); return Sync.now(); }).then(function (n) { if (n) refresh(); });
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
    if (which === "wrong") which = "review";
    document.querySelectorAll(".navlink").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("href") === "#/" + which);
    });
    var b = document.getElementById("rvBadge");
    if (b) { var n = dueItems(allSets()).length; b.textContent = n; b.classList.toggle("hidden", !n); }
  }
  function oxSets() { return ORDER.map(function (id) { return SETS[id]; }); }
  function allSets() { var ex = G.ex(); return oxSets().concat(G.sets(), ex ? [ex] : []); }
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
    if (parts[0] === "quiz" && !session) session = savedSession();   // 새로고침해도 풀던 곳부터
    if (parts[0] === "quiz" && session) return viewQuiz();
    if (parts[0] === "result" && session) return viewResult();
    if (parts[0] === "g" && parts[1] && G.get(decodeURIComponent(parts[1]))) {
      return parts[2] === "list" ? viewGRead(G.get(decodeURIComponent(parts[1]))) : viewGLecture(G.get(decodeURIComponent(parts[1])));
    }
    if (parts[0] === "g") return viewGList();
    if (parts[0] === "ex") return viewEx();
    if (parts[0] === "years") return viewYears();
    if (parts[0] === "search") return viewSearch(decodeURIComponent(parts[1] || ""));
    if (parts[0] === "review" || parts[0] === "wrong") return viewWrong();
    if (parts[0] === "settings") return viewSettings();
    viewHome();
  }

  // ── 홈 ────────────────────────────────────────────
  function reviewCard(sets, back, title) {
    var due = dueItems(sets);
    if (due.length) {
      return '<div class="card review"><div><div class="rv-n">' + due.length + '<small>문제</small></div><p>오늘 복습할 차례예요. 복습 칸에서 골라 풀 수 있어요.</p></div>' +
        '<a class="btn primary" style="text-decoration:none;text-align:center" href="#/review">복습 칸으로</a></div>';
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

  function lockCard() {
    var s = G.state();
    if (s === "ready" || s === "none") return "";
    if (s === "loading" || s === "idle") return '<div class="card note">기출 불러오는 중…</div>';
    return '<div class="card lock"><b>🔒 기출 문제는 잠겨 있어요</b><p>출족·작년 시험은 공개 저장소에 암호화해서 올려 두었어요. ' +
      (s === "error" ? "오류: " + esc(G.err()) + ". " : "") + '설정에서 키를 한 번 넣으면(또는 동기화를 켠 기기면 자동으로) 열려요.</p>' +
      '<a class="btn primary" href="#/settings">설정 열기</a></div>';
  }
  function gTotals() {
    var t = { q: 0, seen: 0, due: 0, lv: [0, 0, 0, 0, 0], total: 0 };
    G.sets().forEach(function (s) {
      var st = stats(s); t.q += st.total; t.total += st.total; t.seen += st.seen; t.due += st.due;
      st.lv.forEach(function (v, i) { t.lv[i] += v; });
    });
    return t;
  }

  function viewHome() {
    document.title = "의대 OX 퀴즈";
    var all = oxSets();
    var html = '<h1>오늘 할 공부</h1><p class="sub">기출(출족·작년 시험)과 자작 OX를 한곳에서. 맞히면 복습 간격이 늘고, 틀리거나 모르면 다시 돌아옵니다.</p>';
    var sv = savedSession();
    if (sv) {
      html += '<div class="card continue" style="margin-top:18px"><p>풀던 것 이어 풀기 · <b>' + esc(sv.title) + "</b> " + (sv.i + 1) + "/" + sv.items.length + "</p>" +
        '<button class="btn primary" id="resumeBtn">이어 풀기</button></div>';
    }
    html += '<div style="margin-top:18px">' + reviewCard(allSets(), "#/", "오늘 복습") + "</div>";

    var gd = G.data();
    html += '<div class="subject-h"><h2>기출</h2><span class="meta">' + (gd ? esc(gd.subject + " · " + gd.term) : "") + "</span></div>";
    html += lockCard();
    if (G.state() === "ready") {
      var t = gTotals();
      var dd = dday({ examDate: gd.examDate });
      html += '<a class="card setcard" href="#/g"><div class="row"><h3>' + esc(gd.subject) + ' 강의별 기출</h3>' + (dd ? '<b class="dd">' + dd + "</b>" : "") + "</div>" +
        '<div class="meta">강의 ' + G.sets().length + "개 · 문항 " + t.q + " · 올해 출족 우선, 없으면 작년 출족</div>" +
        '<div style="margin-top:10px">' + lvBar(t) + "</div>" +
        '<div class="statline"><span>푼 문제 <b>' + t.seen + "</b>/" + t.q + "</span><span>완벽 <b>" + t.lv[4] + "</b></span>" +
        (t.due ? '<span class="duepill">오늘 복습 ' + t.due + "</span>" : "") + "</div></a>";
      html += '<div class="btnrow" style="margin-top:10px"><a class="btn ghost" href="#/years">연도별로 풀기</a><a class="btn ghost" href="#/ex">2025 실제 시험지</a><a class="btn ghost" href="#/search">🔎 기출 검색</a></div>';
    }
    html += '<div class="subject-h"><h2>자작 OX</h2><span class="meta">강조점만</span></div>';

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
      html += '<p class="meta" style="margin:4px 0 8px">' + esc(p[0]) + " · " + esc(p[1]) + '</p><div class="stack">';
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
    bindReview(allSets(), "#/", "오늘 복습");
    var rb = document.getElementById("resumeBtn"); if (rb) rb.onclick = resume;
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
  // 안다·모르겠다·틀렸다 중 틀렸다·모르겠다는 세션 끝에 한 번 더 (안키의 '다시 학습')
  function start(items, grade, back, title, review) {
    if (!items.length) return;
    session = { items: items, i: 0, ans: new Array(items.length), grade: grade, back: back, title: title, review: !!review,
      again: {}, againDone: {}, rate: {}, snap: {}, cur: 1, done: false };
    saveSession();
    location.hash = "#/quiz";
    if (location.hash === "#/quiz") route();
  }
  function resume() {
    var s = savedSession();
    if (!s) return;
    session = s;
    location.hash = "#/quiz";
    if (location.hash === "#/quiz") route();
  }
  var CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  function circ(list) { return (list || []).map(function (n) { return CIRC[n - 1] || n; }).join(""); }
  function ansLabel(v, it) {
    if (v === "?") return "모름";
    if (it && it.set.kind === "g") return Array.isArray(v) ? circ(v) : v ? "맞혔다고 표시" : "틀렸다고 표시";
    return v ? "O" : "X";
  }
  function numSort(a) { return a.slice().sort(function (x, y) { return x - y; }); }
  // 채점: true 맞음 / false 틀림 / "?" 모름 / null 정답 미상(기록 안 함)
  function grade(it, v) {
    if (v === "?") return "?";
    var q = it.q;
    if (it.set.kind !== "g") return v === q.a;
    if (q.type === "short") return v === true;
    if (!q.answer || !q.answer.length) return null;
    v = v || [];
    // 한 개 고르는 문제인데 정답이 여러 개면 '복수정답 인정'
    if (q.type !== "multi" && q.answer.length > 1) return v.length === 1 && q.answer.indexOf(v[0]) >= 0;
    return numSort(q.answer).join(",") === numSort(v).join(",");
  }
  var FLAGS = { oldprof: ["예전 교수 문제", "memo"], otherlec: ["다른 강의 범위", "memo"], outscope: ["올해 범위 밖", "memo"], uncertain: ["정답 확인 필요", "ex"] };
  function gImgs(list) {
    return (list || []).map(function (p) {
      return '<img class="gimg" data-g="' + esc(p[0]) + '" width="' + p[1] + '" height="' + p[2] + '" alt="">';
    }).join("");
  }
  function md(s) {
    var out = [], list = false;
    esc(s || "").split(/\n/).forEach(function (ln) {
      ln = ln.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[외부\]/g, '<span class="ext">외부 지식</span>');
      if (/^\s*[-•·]\s+/.test(ln)) {
        if (!list) { out.push("<ul>"); list = true; }
        out.push("<li>" + ln.replace(/^\s*[-•·]\s+/, "") + "</li>");
      } else {
        if (list) { out.push("</ul>"); list = false; }
        if (ln.trim()) out.push("<p>" + ln + "</p>");
      }
    });
    if (list) out.push("</ul>");
    return out.join("");
  }
  function nChoices(q) { return q.ch && q.ch.length ? Math.min(20, q.ch.length) : Math.max(2, Math.min(20, q.nc || 5)); }
  // 문제 글: 줄 단위, ' | '가 있는 줄이 이어지면 표로
  function stemHTML(s) {
    var out = [], rows = [];
    function flush() {
      if (!rows.length) return;
      out.push('<div class="tbl"><table>' + rows.map(function (r, k) {
        var tag = k === 0 && rows.length > 1 ? "th" : "td";
        return "<tr>" + r.split(/\s*\|\s*/).map(function (c) { return "<" + tag + ">" + esc(c) + "</" + tag + ">"; }).join("") + "</tr>";
      }).join("") + "</table></div>");
      rows = [];
    }
    (s || "").split(/\n/).forEach(function (ln) {
      if (/\s\|\s/.test(ln)) { rows.push(ln.replace(/^\s*\|\s*|\s*\|\s*$/g, "")); return; }
      flush();
      if (ln.trim()) out.push("<p>" + esc(ln) + "</p>");
    });
    flush();
    return out.join("");
  }
  // q의 보기가 지문 목록과 같으면(①1 ②2… 형) 목록은 보기 버튼으로만 보여 준다
  function gCaseHTML(c, q) {
    if (!c) return "";
    if (Array.isArray(c)) c = { img: c };
    if (q && q.ch && c.list && q.ch.length === c.list.length) c = { stem: c.stem, list: [], figs: c.figs, orig: c.orig, img: c.img };
    var body = c.stem || (c.list && c.list.length)
      ? '<div class="stem">' + stemHTML(c.stem) + "</div>" +
        (c.list && c.list.length ? '<div class="clist">' + c.list.map(function (x, k) { return "<p><b>" + (CIRC[k] || k + 1) + "</b> " + esc(x) + "</p>"; }).join("") + "</div>" : "") +
        figBox(c.figs) + (c.orig ? gImgs(c.img) : "")
      : gImgs(c.img);
    return body ? '<div class="gcase"><span class="note">공통 지문</span>' + body + "</div>" : "";
  }
  function gStemHTML(q) {
    if (q.stem) {
      return '<div class="stem">' + stemHTML(q.stem) + "</div>" + figBox(q.figs) + (q.orig ? gImgs(q.qi) : "") +
        (!q.orig && q.qi && q.qi.length ? '<details class="orig"><summary>원본 캡처 보기</summary>' + gImgs(q.qi) + "</details>" : "");
    }
    return q.qi && q.qi.length ? gImgs(q.qi) : '<p class="qtext">' + esc(q.t) + "</p>";
  }
  // 그림 여러 장은 한 상자에 (한눈에 모드에선 옆으로 나란히)
  function figBox(list) { return list && list.length ? '<div class="figs n' + list.length + '">' + gImgs(list) + "</div>" : ""; }
  function gChoiceList(q) {
    if (!q.ch || !q.ch.length) return "";
    return '<div class="clist">' + q.ch.map(function (x, k) { return "<p><b>" + (CIRC[k] || k + 1) + "</b> " + esc(x) + "</p>"; }).join("") + "</div>";
  }
  function gAnswerStr(q) { return q.type === "short" ? (q.answerText || "모범답안 없음") : (q.answer && q.answer.length ? circ(q.answer) : "정답 미상"); }
  function gMeta(set, q, mixed) {
    var ex = set.lid === "EX2025";
    var y = (q.years || []).join("·");
    return '<div class="qmeta">' +
      (mixed || ex ? '<span class="pill src">' + esc(ex ? q.prof + " 교수 · 2025 시험" : set.title) + "</span>" : "") +
      (q.n != null ? '<span class="pill">' + (ex ? "" : "출족 ") + q.n + "번</span>" : "") +
      (y && !ex ? '<span class="pill ex">' + esc(y) + "</span>" : "") +
      (q.src && !ex ? '<span class="pill">' + esc(q.src) + "</span>" : "") +
      (FLAGS[q.flag] ? '<span class="pill ' + FLAGS[q.flag][1] + '" title="' + esc(q.flagNote) + '">' + FLAGS[q.flag][0] + "</span>" : "") +
      (q.type === "multi" ? '<span class="pill">모두 고르기</span>' : q.type === "short" ? '<span class="pill">주관식</span>' : "") + "</div>";
  }
  function gExplain(q) {
    return (q.key ? '<p class="gkey">💡 ' + esc(q.key) + "</p>" : "") +
      (q.easy ? '<div class="easy">' + md(q.easy) + "</div>" : '<p class="note">아직 쉬운 해설이 없어요. 아래 출족 원래 풀이를 참고하세요.</p>') +
      (q.flagNote ? '<p class="note">⚠ ' + esc(q.flagNote) + "</p>" : "") +
      (q.ref ? '<p class="note">근거: ' + esc(q.ref) + "</p>" : "") +
      (q.ai && q.ai.length ? '<details class="orig"><summary>출족에 있던 원래 풀이 보기</summary>' + gImgs(q.ai) + "</details>" : "");
  }

  function viewQuiz() {
    var S = session;
    if (S.done) { location.hash = "#/result"; return; }
    var it = S.items[S.i];
    var set = it.set, q = it.q, t = set.topicMap ? set.topicMap[q.t] : null;
    var isG = set.kind === "g";
    var picked = S.ans[S.i];
    var revealed = S.grade === "instant" && picked !== undefined;
    var answered = S.ans.filter(function (a) { return a !== undefined; }).length;
    var r = rec(set.id, q.id);
    document.title = (S.i + 1) + "/" + S.items.length + " — 의대 OX";

    var html = '<div class="qtop"><a class="iconbtn" href="' + S.back + '" title="그만 풀기 (Esc)" aria-label="그만 풀기">✕</a>' +
      '<div class="bar"><i class="ok" style="width:' + pct(S.grade === "exam" ? answered : S.i + (revealed ? 1 : 0), S.items.length) + '%"></i></div>' +
      '<span class="count">' + (S.i + 1) + " / " + S.items.length + '</span>' +
      (isG ? '<button class="iconbtn fitbtn" id="fitBtn" aria-pressed="' + isFit() + '" title="한눈에 모드 — 문제·사진·보기를 한 화면에 (F)">한눈에</button>' : "") +
      '<button class="iconbtn" id="starBtn" aria-pressed="' + isStar(set.id, q.id) + '" title="별표 — 헷갈려서 다시 볼 문제 표시 (S)" aria-label="별표">★</button></div>';

    var mixed = S.items.some(function (x) { return x.set !== set; });
    if (isG) {
      html += gQuizBody(S, it, picked, revealed, mixed);
    } else {
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
      html += '<div class="verdict ' + (ok ? "ok" : "ng") + '"><div class="head">' + verdictHead(S, ok, picked) + ' · 답은 ' + (q.a ? "O" : "X") +
        nextRvTxt(S, set, q, ok) + '</div>' + (q.why ? "<p>" + esc(q.why) + "</p>" : "") + "</div>";
      html += rateButtons(S, ok);
    }
    }
    if (!revealed && r && S.grade === "instant") {
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
    var after = ' &nbsp;·&nbsp; 답 본 뒤 <kbd>→</kbd> 안다 <kbd>←</kbd> 모르겠다(찍었음)';
    html += isG
      ? '<p class="kbd">' + (q.type === "short" ? "<kbd>→</kbd> 답 보기 → <kbd>→</kbd> 안다 <kbd>←</kbd> 틀렸다 <kbd>↓</kbd> 모르겠다"
        : "<kbd>↑</kbd><kbd>↓</kbd> 보기 이동 &nbsp; <kbd>→</kbd> 고르기" + (q.type === "multi" ? "·빼기 <kbd>Enter</kbd> 채점" : "") + " &nbsp; <kbd>←</kbd> 모르겠다") + after + ' &nbsp; <kbd>S</kbd> 별표</p>'
      : '<p class="kbd"><kbd>→</kbd> 맞다(O) &nbsp; <kbd>←</kbd> 틀리다(X) &nbsp; <kbd>↓</kbd> 모르겠다' + after + ' &nbsp; <kbd>S</kbd> 별표</p>';
    app().innerHTML = html;
    if (isG) G.hydrate(app());

    S.rate = S.rate || {}; S.snap = S.snap || {}; S.againDone = S.againDone || {}; S.cur = S.cur || 1;
    var key = set.id + ":" + q.id;
    // 틀렸다·모르겠다는 세션에 다시 끼워 넣지 않고 '복습' 칸으로 모은다 (사용자가 골라서 복습)
    function requeue() {}
    function answer(v) {
      if (revealed) return;
      S.ans[S.i] = v; S.sel = null; S.peek = false;
      if (S.grade === "instant") {
        var g = grade(it, v);
        S.snap[S.i] = store.r[key] ? JSON.stringify(store.r[key]) : null;
        if (g !== null) {
          var res = g === true ? "know" : g === "?" ? "unsure" : "wrong";
          record(set, q.id, res); S.rate[S.i] = res; save();
          if (res !== "know") requeue();
        }
      } else if (S.i + 1 < S.items.length) S.i++;
      saveSession();
      viewQuiz();
    }
    // 맞혔지만 확실하지 않았다 → 안다 대신 모르겠다로 다시 기록
    function unsure() {
      if (!revealed || S.rate[S.i] !== "know") return next();
      if (S.snap[S.i]) store.r[key] = JSON.parse(S.snap[S.i]); else delete store.r[key];
      record(set, q.id, "unsure"); S.rate[S.i] = "unsure"; save(); requeue();
      next();
    }
    function next() {
      if (S.grade === "instant" && !revealed) return;
      S.sel = null; S.peek = false; S.cur = 1;
      if (S.i + 1 < S.items.length) { S.i++; saveSession(); viewQuiz(); window.scrollTo(0, 0); }
      else finish();
    }
    function move(d) { S.sel = null; S.peek = false; S.cur = 1; S.i += d; saveSession(); viewQuiz(); window.scrollTo(0, 0); }
    function choose(c) {
      if (revealed || !isG || q.type === "short") return;
      var n = nChoices(q);
      if (c < 1 || c > n) return;
      if (q.type === "multi") {
        S.sel = S.sel || (Array.isArray(picked) ? picked.slice() : []);
        var i = S.sel.indexOf(c);
        if (i >= 0) S.sel.splice(i, 1); else S.sel.push(c);
        viewQuiz();
      } else answer([c]);
    }
    function enter() {
      if (revealed) return next();
      if (!isG) return;
      if (q.type === "multi" && S.sel && S.sel.length) return answer(numSort(S.sel));
      if (q.type === "short" && !S.peek) { S.peek = true; viewQuiz(); }
    }
    document.querySelectorAll(".ox button").forEach(function (b) {
      b.onclick = function () { answer(b.dataset.v === "?" ? "?" : b.dataset.v === "1"); };
    });
    document.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { choose(+b.dataset.c); }; });
    document.querySelectorAll(".gbtns .idk, .choices .idk").forEach(function (b) { b.onclick = function () { answer("?"); }; });
    var mb = document.getElementById("multiBtn"); if (mb) mb.onclick = enter;
    var pk = document.getElementById("peekBtn"); if (pk) pk.onclick = enter;
    document.querySelectorAll("[data-self]").forEach(function (b) { b.onclick = function () { answer(b.dataset.self === "1"); }; });
    var nb = document.getElementById("nextBtn"); if (nb) { nb.onclick = next; nb.focus({ preventScroll: true }); }
    var ub = document.getElementById("unsureBtn"); if (ub) ub.onclick = unsure;
    var fb = document.getElementById("fitBtn"); if (fb) fb.onclick = function () { setFit(!isFit()); viewQuiz(); };
    document.getElementById("starBtn").onclick = function () { toggleStar(set.id, q.id); this.setAttribute("aria-pressed", isStar(set.id, q.id)); };
    var pb = document.getElementById("prevBtn"); if (pb) pb.onclick = function () { move(-1); };
    var sk = document.getElementById("skipBtn"); if (sk) sk.onclick = function () { move(1); };
    var sb = document.getElementById("submitBtn");
    if (sb) sb.onclick = function () {
      var left = S.items.length - answered;
      if (left && !confirm(left + "문제를 안 풀었어요. 그래도 채점할까요? (안 푼 문제는 기록에 남지 않아요)")) return;
      S.items.forEach(function (x, k) {
        var a = S.ans[k];
        if (a === undefined) return;
        var g = grade(x, a);
        if (g !== null) record(x.set, x.q.id, g === true ? true : g === "?" ? "?" : false);
      });
      save(); finish();
    };
    document.querySelectorAll(".dots button").forEach(function (b) { b.onclick = function () { S.sel = null; S.peek = false; S.i = +b.dataset.k; viewQuiz(); }; });

    document.onkeydown = function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
      var c = e.code, dm = /^(?:Digit|Numpad)(\d)$/.exec(c);
      var R = c === "ArrowRight", L = c === "ArrowLeft", U = c === "ArrowUp", D = c === "ArrowDown";
      var lb = document.querySelector(".lightbox");
      if (lb) { if (c === "Escape" || c === "Enter" || c === "Space") { e.preventDefault(); lb.remove(); } return; }
      if (c === "KeyS") { document.getElementById("starBtn").click(); return; }
      if (c === "KeyF" && isG) { setFit(!isFit()); viewQuiz(); return; }
      if (c === "Escape") { location.hash = S.back; return; }
      if (R || L || U || D || c === "Enter" || c === "Space") e.preventDefault();
      // 답을 본 뒤: → 안다(다음), ← 모르겠다(찍었음)
      if (revealed) {
        if (R || c === "Enter" || c === "Space") next();
        else if (L || D) unsure();
        return;
      }
      if (S.grade === "exam" && c === "PageUp" && S.i) return move(-1);
      if (S.grade === "exam" && c === "PageDown" && S.i + 1 < S.items.length) return move(1);
      if (!isG) {   // OX: → 맞다, ← 틀리다, ↓ 모르겠다
        if (R || c === "KeyO" || c === "Digit1" || c === "Numpad1") answer(true);
        else if (L || c === "KeyX" || c === "Digit2" || c === "Numpad2") answer(false);
        else if (D || c === "Slash" || c === "Digit3" || c === "Numpad3") answer("?");
        else if (U && S.grade === "exam" && S.i) move(-1);
        return;
      }
      if (dm) return choose(+dm[1]);
      if (q.type === "short") {   // 주관식: → 답 보기, 그다음 → 안다 · ← 틀렸다 · ↓ 모르겠다
        if (!S.peek) { if (R || c === "Enter" || c === "Space") enter(); else if (L || D) answer("?"); }
        else if (R) answer(true); else if (L) answer(false); else if (D) answer("?");
        return;
      }
      // 객관식: ↑↓ 보기 이동, → 고르기, ← 모르겠다, (모두 고르기는 → 로 넣고 빼기 · Enter 채점)
      var n = nChoices(q);
      if (D) { S.cur = Math.min(n, S.cur + 1); viewQuiz(); }
      else if (U) { S.cur = Math.max(1, S.cur - 1); viewQuiz(); }
      else if (R || c === "Space") choose(S.cur);
      else if (c === "Enter") { if (q.type === "multi") enter(); else choose(S.cur); }
      else if (L) answer("?");
    };
  }

  // 한눈에 모드 (그림 높이를 줄이고 넓은 화면에선 문제|보기 두 칸) — 이 기기에 기억
  function isFit() { try { return localStorage.getItem("mox:fit") === "1"; } catch (e) { return false; } }
  function setFit(on) {
    try { localStorage.setItem("mox:fit", on ? "1" : "0"); } catch (e) {}
    document.body.classList.toggle("fit", !!on);
  }
  // 그림을 누르면 크게 보기
  document.addEventListener("click", function (e) {
    var im = e.target.closest && e.target.closest("img.gimg.on");
    if (im && !e.target.closest(".lightbox")) {
      var box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = '<img src="' + im.src + '" alt=""><span class="lbclose">닫기 ✕</span>';
      box.onclick = function () { box.remove(); };
      document.body.appendChild(box);
    }
  });
  function gQuizBody(S, it, picked, revealed, mixed) {
    var set = it.set, q = it.q;
    var cs = q.case && set.L.cases && set.L.cases[q.case];
    // 한눈에 모드: 왼쪽(문제·그림) | 오른쪽(보기·채점·해설)으로 나눠 그린다
    var left = '<div class="card qcard gq">' + gMeta(set, q, mixed) +
      (S.again[S.i] ? '<span class="pill memo">한 번 더</span>' : "") +
      gCaseHTML(cs, q) + gStemHTML(q) + "</div>";
    var html = "";
    if (q.type === "short") {
      if (!revealed) {
        if (!S.peek) html += '<div class="gbtns"><button class="btn primary" id="peekBtn">답 보기</button><button class="idk" data-v="?">모르겠다</button></div>';
        else html += '<div class="verdict"><div class="head">모범답안</div><p>' + esc(q.answerText || "모범답안 없음 — 해설을 보고 판단") + '</p></div>' +
          '<div class="gbtns"><button class="btn primary" data-self="1">맞혔다</button><button class="btn" data-self="0">틀렸다</button></div>';
      }
    } else {
      var n = nChoices(q);
      var mine = Array.isArray(picked) ? picked : [];
      var sel = S.sel || (S.grade === "exam" ? mine : []);
      var wide = q.ch && q.ch.length;
      html += '<div class="choices' + (wide ? " wide" : n > 6 ? " many" : "") + '">';
      for (var c = 1; c <= n; c++) {
        var cl = "choice";
        if (revealed) {
          if ((q.answer || []).indexOf(c) >= 0) cl += " right";
          else if (mine.indexOf(c) >= 0) cl += " wrong";
        } else {
          if (sel.indexOf(c) >= 0) cl += " pick";
          if (c === (S.cur || 1)) cl += " cur";
        }
        html += '<button class="' + cl + '" data-c="' + c + '"' + (revealed ? " disabled" : "") + ">" +
          (wide ? '<b class="cn">' + CIRC[c - 1] + "</b><span>" + esc(q.ch[c - 1] || "") + "</span>" : CIRC[c - 1]) + "</button>";
      }
      html += "</div>";
      if (!revealed) {
        html += '<div class="gbtns">' + (q.type === "multi" ? '<button class="btn primary" id="multiBtn"' + (sel.length ? "" : " disabled") + ">" + (sel.length ? sel.length + "개 골라 채점" : "모두 골라 주세요") + "</button>" : "") +
          '<button class="idk" data-v="?">모르겠다</button></div>';
      }
    }
    if (revealed) {
      var g = grade(it, picked);
      html += '<div class="verdict ' + (g === true ? "ok" : g === null ? "" : "ng") + '"><div class="head">' +
        (g === null ? "채점 보류" : verdictHead(S, g === true, picked)) + " · 답 " + esc(gAnswerStr(q)) +
        (g === null ? '<span class="nextrv">정답이 확실하지 않아 기록하지 않았어요</span>' : nextRvTxt(S, set, q, g === true)) + "</div></div>";
      html += rateButtons(S, g === true);
      html += '<div class="card gexp">' + gExplain(q) + "</div>";
    }
    return '<div class="qgrid"><div class="qleft">' + left + '</div><div class="qright">' + html + "</div></div>";
  }

  // 결과 머리말·다음 복습 안내·안다/모르겠다 버튼
  function verdictHead(S, ok, picked) {
    var rt = S.rate && S.rate[S.i];
    if (picked === "?") return "모르겠다";
    if (!ok) return "틀렸다";
    return rt === "unsure" ? "정답 · 모르겠다로 기록" : "정답";
  }
  function nextRvTxt(S, set, q, ok) {
    var nr = rec(set.id, q.id);
    if (!nr || nr.d == null) return "";
    var t = nr.d <= today() ? "복습 칸에 들어갔어요" : "다음 복습 " + dLabel(nr.d - today());
    return '<span class="nextrv">' + t + "</span>";
  }
  function rateButtons(S, ok) {
    var last = S.i + 1 >= S.items.length;
    if (ok && S.rate && S.rate[S.i] === "know") {
      return '<div class="qnav rate"><button class="btn ghost" id="unsureBtn">← 모르겠다 <span class="sub2">(찍었음)</span></button>' +
        '<button class="btn primary" id="nextBtn">안다 →</button></div>';
    }
    return '<div class="qnav"><button class="btn primary" id="nextBtn">' + (last ? "결과 보기 →" : "다음 →") + "</button></div>";
  }

  function finish() {
    session.done = true;
    saveSession();
    Sync.now();
    location.hash = "#/result";
  }

  // ── 결과 ──────────────────────────────────────────
  function viewResult() {
    var S = session;
    document.title = "결과 — 의대 OX";
    var tot = 0, ok = 0, unk = 0, byT = {}, wrong = [], seen = {}, cnt = { know: 0, unsure: 0, wrong: 0 };
    S.items.forEach(function (x, k) {
      var a = S.ans[k];
      if (a === undefined || S.again[k]) return; // 점수는 첫 시도만
      var g = grade(x, a);
      if (g === null) return;
      tot++;
      cnt[(S.rate && S.rate[k]) || (g === true ? "know" : g === "?" ? "unsure" : "wrong")]++;
      var key = x.set.id + "|" + (x.set.kind === "g" ? "" : x.q.t);
      byT[key] = byT[key] || { name: x.set.kind === "g" ? x.set.title : x.set.topicMap[x.q.t].name, ok: 0, n: 0 };
      byT[key].n++;
      if (g === true) { ok++; byT[key].ok++; }
      else {
        if (g === "?") unk++;
        if (!seen[x.set.id + ":" + x.q.id]) { seen[x.set.id + ":" + x.q.id] = 1; wrong.push({ x: x, a: a }); }
      }
    });
    var p = pct(ok, tot);
    var up = upcoming(allSets());
    var html = '<a class="crumb" href="' + S.back + '">← ' + esc(S.title) + '</a><h1>결과</h1>' +
      '<div class="card score" style="margin-top:12px"><div class="ring" style="--p:' + p + '"><span>' + p + '%</span></div>' +
      '<div><div style="font-size:18px;font-weight:700">' + ok + " / " + tot + ' 맞음</div>' +
      '<div class="rcount"><span class="k">안다 <b>' + cnt.know + '</b></span><span class="u">모르겠다 <b>' + cnt.unsure + '</b></span><span class="w">틀렸다 <b>' + cnt.wrong + "</b></span></div>" +
      '<p class="sub">' + (cnt.unsure + cnt.wrong ? "모르겠다·틀렸다는 간격이 줄어 곧 다시 나와요." : "전부 안다! 간격이 늘어났어요.") +
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
    G.hydrate(app());
    var rw = document.getElementById("retryWrong");
    if (rw) rw.onclick = function () { start(wrong.map(function (w) { return w.x; }), S.grade, S.back, S.title); };
    var firsts = S.items.filter(function (_, k) { return !S.again[k]; });
    document.getElementById("retryAll").onclick = function () { start(firsts, S.grade, S.back, S.title); };
  }

  function witem(set, q, picked) {
    if (set.kind === "g") {
      return '<div class="card witem">' + gMeta(set, q, true) +
        '<details class="wq"><summary>문제 보기</summary>' + gStemHTML(q) + gChoiceList(q) + "</details>" +
        '<p class="q">' + esc((q.t || "").slice(0, 140)) + (q.t && q.t.length > 140 ? "…" : "") + "</p>" +
        '<div class="ans">정답 <b>' + esc(gAnswerStr(q)) + "</b>" + (picked !== undefined ? " · 내 답 <b>" + esc(ansLabel(picked, { set: set })) + "</b>" : "") + "</div>" +
        (q.key ? '<p class="why">💡 ' + esc(q.key) + "</p>" : "") + "</div>";
    }
    var t = set.topicMap[q.t];
    return '<div class="card witem"><div class="qmeta"><span class="pill src">' + esc(t.name) + '</span><span class="pill">' + esc(srcLabel(set, t)) + "</span>" +
      (q.ex ? '<span class="pill ex">기출 ' + esc(q.ex) + "</span>" : "") + "</div>" +
      '<p class="q">' + esc(q.q) + "</p>" +
      '<div class="ans">정답 <b class="' + (q.a ? "o" : "x") + '">' + (q.a ? "O" : "X") + "</b>" +
      (picked !== undefined ? ' · 내 답 <b class="' + (picked === "?" ? "" : picked ? "o" : "x") + '">' + ansLabel(picked) + "</b>" : "") + "</div>" +
      (q.why ? '<p class="why">' + esc(q.why) + "</p>" : "") + "</div>";
  }

  // ── 기출 화면들 ───────────────────────────────────
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  var gOpts = {};
  function dateLabel(md) {
    var p = md.split("/"), y = (G.data() && G.data().examDate || "2026").slice(0, 4);
    return md + " (" + WD[new Date(+y, +p[0] - 1, +p[1]).getDay()] + ")";
  }
  function srcKind(L) {
    var k = {};
    (L.sources || []).forEach(function (s) { k[s.kind] = 1; });
    return Object.keys(k).join("·");
  }
  function isOff(q) { return /oldprof|otherlec|outscope/.test(q.flag || ""); }

  function viewGList() {
    document.title = "기출 — 의대 OX";
    if (G.state() !== "ready") { app().innerHTML = '<a class="crumb" href="#/">← 홈</a><h1>기출</h1>' + lockCard(); return; }
    var d = G.data(), sets = G.sets();
    var html = '<a class="crumb" href="#/">← 홈</a><h1>' + esc(d.subject) + " 기출</h1>" +
      '<p class="sub">강의마다 올해 출족이 있으면 올해 것, 없으면 작년 출족을 넣었어요. 교수님이 바뀐 강의와 예전 교수 문제는 표시해 뒀어요. <b class="dd">' + dday({ examDate: d.examDate }) + "</b></p>";
    html += '<div style="margin-top:14px">' + reviewCard(sets, "#/g", "기출 복습") + "</div>";
    html += '<div class="btnrow" style="margin-top:10px"><a class="btn primary" href="#/years">연도별로 풀기</a><a class="btn ghost" href="#/ex">2025 실제 시험지</a><a class="btn ghost" href="#/search">🔎 검색</a></div>';
    var byDate = {}, dates = [];
    sets.forEach(function (s) { var k = s.L.date; if (!byDate[k]) { byDate[k] = []; dates.push(k); } byDate[k].push(s); });
    dates.forEach(function (dt) {
      html += '<h2 class="dateh">' + dateLabel(dt) + '</h2><div class="stack">';
      byDate[dt].forEach(function (s) {
        var L = s.L, st = stats(s);
        var old = L.questions.filter(function (q) { return q.flag === "oldprof"; }).length;
        html += '<a class="card lrow" href="#/g/' + encodeURIComponent(L.id) + '">' +
          '<span class="period">' + esc(L.period || "–") + '</span><div class="lmain"><div class="ltitle">' + esc(L.title) + "</div>" +
          '<div class="meta">' + esc(L.prof) + " · " + st.total + "문항 · " + esc(srcKind(L)) +
          (L.newProf ? ' · <b class="dd">올해 교수 바뀜</b>' : old ? " · 예전 교수 문제 " + old : "") + (!L.exam ? ' · <b class="dd">시험 X</b>' : "") +
          (st.due ? ' · <span class="duepill">복습 ' + st.due + "</span>" : "") + "</div>" +
          '<div style="margin-top:6px">' + lvBar(st) + "</div></div></a>";
      });
      html += "</div>";
    });
    app().innerHTML = html;
    bindReview(sets, "#/g", "기출 복습");
  }

  // 문항의 연도 (여러 해에 나온 문제는 여러 개, 표시 없으면 "?")
  function qYears(q) { return q.years && q.years.length ? q.years : ["?"]; }
  function yearList(sets) {
    var c = {};
    sets.forEach(function (s) { s.questions.forEach(function (q) { qYears(q).forEach(function (y) { c[y] = (c[y] || 0) + 1; }); }); });
    return Object.keys(c).sort(function (a, b) { return a === "?" ? 1 : b === "?" ? -1 : b - a; }).map(function (y) { return [y, c[y]]; });
  }
  // 연도순 정렬: 문항의 가장 최근 출제 연도 기준, 연도 미상은 맨 뒤 (같은 해 안에서는 원래 순서)
  function byYear(qs, dir) {
    var top = function (q) { var y = (q.years || []).filter(function (v) { return v > 0; }); return y.length ? Math.max.apply(null, y) : null; };
    return qs.map(function (q, i) { return { q: q, i: i, y: top(q) }; }).sort(function (a, b) {
      if (a.y === b.y) return a.i - b.i;
      if (a.y === null) return 1; if (b.y === null) return -1;
      return dir === "old" ? a.y - b.y : b.y - a.y;
    }).map(function (x) { return x.q; });
  }
  function hasYear(q, y) { return y === "all" || qYears(q).map(String).indexOf(String(y)) >= 0; }
  function gPick(s, o) {
    return s.questions.filter(function (q) {
      if (o.scope === "now" && isOff(q)) return false;
      if (o.year && !hasYear(q, o.year)) return false;
      var r = rec(s.id, q.id);
      if (o.filter === "unseen") return !r;
      if (o.filter === "due") return isDue(s.id, q.id);
      if (o.filter === "weak") return r && level(r) <= 2;
      if (o.filter === "star") return isStar(s.id, q.id);
      return true;
    });
  }

  function viewGLecture(s) {
    if (s.lid === "EX2025") { location.hash = "#/ex"; return; }
    var L = s.L, n = L.note || {}, back = "#/g/" + encodeURIComponent(L.id);
    document.title = L.title + " — 기출";
    var o = gOpts[s.id] = gOpts[s.id] || { filter: "all", scope: "all", order: "new", grade: "instant", year: "all" };
    var st = stats(s);
    var exq = (G.ex() ? G.ex().questions : []).filter(function (q) { return q.lecture === L.id; });
    var ox = oxSets().filter(function (x) { return (x.gLectures || []).indexOf(L.id) >= 0; });
    var off = s.questions.filter(isOff).length;
    var dd = dday(s);

    var html = '<a class="crumb" href="#/g">← 기출 목록</a><h1>' + esc(L.title) + "</h1>" +
      '<p class="sub">' + esc(dateLabel(L.date)) + (L.period ? " " + esc(L.period) + "교시" : "") + " · " + esc(L.prof) + " 교수님" +
      (!L.exam ? ' · <b class="dd">올해 시험 X</b>' : "") + (dd ? ' · <b class="dd">' + dd + "</b>" : "") + "</p>" +
      '<p class="note">출처: ' + (L.sources || []).map(function (x) { return esc(x.kind + " " + x.file + (x.pages ? " " + x.pages[0] + "~" + x.pages[1] + "쪽" : "")); }).join(", ") + "</p>" +
      '<div class="card" style="margin-top:12px">' + lvBar(st) + lvLegend(st) + "</div>" +
      '<div style="margin-top:10px">' + reviewCard([s], back, L.title) + "</div>";

    html += '<h2>교수·출제 분석</h2><div class="card analysis">';
    if (n.profHistory || n.examTip || n.yearNotes) {
      if (n.profHistory) html += "<h3>교수 변경</h3>" + md(n.profHistory);
      if (n.examTip) html += "<h3>올해 시험 정보·경향</h3>" + md(n.examTip);
      if (n.yearNotes) html += "<h3>연도·범위 주의</h3>" + md(n.yearNotes);
    } else html += '<p class="note">분석 준비 중이에요. 아래 출족 코멘트 원문을 참고하세요.</p>';
    if (off) html += '<p class="note">이 강의 기출 중 <b>' + off + "문항</b>은 예전 교수·다른 강의·올해 범위 밖으로 표시돼 있어요.</p>";
    if (L.comment) html += '<details class="orig"><summary>출족 제작자 코멘트 원문</summary><p class="pre">' + esc(L.comment) + "</p></details>";
    html += "</div>";

    if (n.summary && n.summary.length) {
      html += '<h2>빈출 개념</h2><div class="card"><ul class="sumlist">' + n.summary.map(function (x) { return "<li>" + md(x).replace(/^<p>|<\/p>$/g, "") + "</li>"; }).join("") + "</ul></div>";
    }
    if (ox.length || exq.length) {
      html += '<div class="btnrow" style="margin-top:14px">' +
        ox.map(function (x) { return '<a class="btn ghost" href="#/set/' + encodeURIComponent(x.id) + '">자작 OX · ' + esc(x.title) + "</a>"; }).join("") +
        (exq.length ? '<button class="btn ghost" id="exHere">2025 시험 이 강의 ' + exq.length + "문항</button>" : "") + "</div>";
    }

    html += '<h2>골라서 풀기</h2><div class="card opts">' +
      seg("year", "연도", [["all", "전체"]].concat(yearList([s]).map(function (y) { return [y[0], (y[0] === "?" ? "연도 미상" : y[0]) + " (" + y[1] + ")"]; })), String(o.year)) +
      seg("filter", "문항", [["all", "전체"], ["unseen", "안 푼 것"], ["due", "복습 차례"], ["weak", "약한 것"], ["star", "★ 별표"]], o.filter) +
      (off ? seg("scope", "범위", [["all", "전부"], ["now", "지금 교수·범위만 (" + off + "개 빼기)"]], o.scope) : "") +
      seg("order", "순서", [["seq", "출족 순서"], ["new", "최신 연도부터"], ["old", "오래된 연도부터"], ["shuffle", "섞기"]], o.order) +
      seg("grade", "채점", [["instant", "바로 확인"], ["exam", "시험처럼 (끝나고 채점)"]], o.grade) + "</div>";
    html += '<div class="startbar btnrow"><button class="btn primary" id="startBtn" style="flex:2"></button><a class="btn" style="flex:1;text-align:center;text-decoration:none" href="' + back + '/list">쫙 보기</a></div>';
    app().innerHTML = html;
    bindReview([s], back, L.title);

    function refreshBtn() {
      var k = gPick(s, o).length, b = document.getElementById("startBtn");
      b.textContent = k ? k + "문제 풀기" : "조건에 맞는 문제가 없어요"; b.disabled = !k;
    }
    document.querySelectorAll(".opts .seg").forEach(function (g) {
      g.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        o[g.dataset.k] = b.dataset.v;
        g.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        refreshBtn();
      };
    });
    document.getElementById("startBtn").onclick = function () {
      var qs = gPick(s, o);
      qs = o.order === "shuffle" ? shuffle(qs.slice()) : o.order === "seq" ? qs : byYear(qs, o.order);
      start(qs.map(function (q) { return { set: s, q: q }; }), o.grade, back, L.title, o.filter === "due");
    };
    var eh = document.getElementById("exHere");
    if (eh) eh.onclick = function () { start(exq.map(function (q) { return { set: G.ex(), q: q }; }), "instant", back, L.title); };
    refreshBtn();
  }

  // 연도별로 풀기: 모든 강의에서 그해 나온 문제를 강의 순서대로 모은다
  var yOpts = { year: null, scope: "all", grade: "instant", filter: "all" };
  function viewYears() {
    document.title = "연도별 기출 — 의대 OX";
    if (G.state() !== "ready") { app().innerHTML = '<a class="crumb" href="#/g">← 기출 목록</a><h1>연도별로 풀기</h1>' + lockCard(); return; }
    var sets = G.sets(), years = yearList(sets);
    // 처음엔 문제가 넉넉한 가장 최근 해부터
    if (!yOpts.year) yOpts.year = (years.filter(function (y) { return y[0] !== "?" && y[1] >= 20; })[0] || years[0] || ["?"])[0];
    var o = { year: yOpts.year, scope: yOpts.scope, filter: yOpts.filter };
    var picks = [];
    sets.forEach(function (s) { gPick(s, o).forEach(function (q) { picks.push({ set: s, q: q }); }); });
    var byL = {}, order = [];
    picks.forEach(function (x) { if (!byL[x.set.id]) { byL[x.set.id] = 0; order.push(x.set); } byL[x.set.id]++; });

    var html = '<a class="crumb" href="#/g">← 기출 목록</a><h1>연도별로 풀기</h1>' +
      '<p class="sub">고른 해에 나온 출족 문제를 모든 강의에서 모아 강의 순서대로 풀어요. 여러 해에 반복해서 나온 문제는 해마다 들어가요. 작년 실제 시험지는 <a href="#/ex">2025 실제 시험지</a>에서 따로 풀 수 있어요.</p>' +
      '<div class="yeargrid">' + years.map(function (y) {
        return '<button class="chip" data-y="' + esc(y[0]) + '" aria-pressed="' + (String(y[0]) === String(yOpts.year)) + '">' + (y[0] === "?" ? "연도 미상" : y[0]) + ' <span class="n">' + y[1] + "</span></button>";
      }).join("") + "</div>" +
      '<div class="card opts" style="margin-top:12px">' +
      seg("filter", "문항", [["all", "전체"], ["unseen", "안 푼 것"], ["weak", "약한 것"]], yOpts.filter) +
      seg("scope", "범위", [["all", "전부"], ["now", "지금 교수·범위만"]], yOpts.scope) +
      seg("grade", "채점", [["instant", "바로 확인"], ["exam", "시험처럼 (끝나고 채점)"]], yOpts.grade) + "</div>";
    html += '<h2>' + (yOpts.year === "?" ? "연도 미상" : esc(yOpts.year) + "년") + ' <span class="meta">' + picks.length + "문항 · 강의 " + order.length + "개</span></h2>";
    html += order.length ? '<div class="card"><ul class="focus">' + order.map(function (s) {
      return '<li><span class="where">' + esc(s.L.date) + '</span><span>' + esc(s.title) + ' <span class="meta">' + esc(s.professor) + " · " + byL[s.id] + "문항</span></span></li>";
    }).join("") + "</ul></div>" : '<p class="empty">조건에 맞는 문제가 없어요.</p>';
    html += '<div class="startbar"><button class="btn primary block" id="yStart"' + (picks.length ? "" : " disabled") + ">" + picks.length + "문제 풀기</button></div>";
    app().innerHTML = html;
    document.querySelectorAll("[data-y]").forEach(function (b) { b.onclick = function () { yOpts.year = b.dataset.y; viewYears(); }; });
    document.querySelectorAll(".opts .seg").forEach(function (g) {
      g.onclick = function (e) { var b = e.target.closest("button"); if (!b) return; yOpts[g.dataset.k] = b.dataset.v; viewYears(); };
    });
    document.getElementById("yStart").onclick = function () {
      start(picks, yOpts.grade, "#/years", (yOpts.year === "?" ? "연도 미상" : yOpts.year + "년") + " 기출");
    };
  }

  // 쫙 보기: 문제를 쭉 넘겨 보고 답·해설은 필요할 때만 펼친다
  function viewGRead(s) {
    var L = s.L, back = "#/g/" + encodeURIComponent(L.id);
    document.title = L.title + " 쫙 보기 — 기출";
    var ro = (gOpts[s.id] || {}).order || "new";   // 강의 화면에서 고른 순서를 따름 (섞기면 출족 순서)
    var html = '<a class="crumb" href="' + back + '">← ' + esc(L.title) + "</a><h1>쫙 보기</h1>" +
      '<p class="sub">문제를 쭉 넘겨 보고, 필요할 때만 답·해설을 펼쳐요. (여기서 본 건 기록에 안 남아요)</p>' +
      '<div class="card opts" style="margin-top:12px">' + seg("order", "순서", [["seq", "출족 순서"], ["new", "최신 연도부터"], ["old", "오래된 연도부터"]], ro === "shuffle" ? "seq" : ro) + "</div>" +
      '<div class="btnrow" style="margin:12px 0"><button class="btn" id="openAll">답·해설 전부 펼치기</button></div><div class="wlist">';
    var shown = {};
    (ro === "new" || ro === "old" ? byYear(s.questions, ro) : s.questions).forEach(function (q) {
      var cs = q.case && !shown[q.case] && L.cases && L.cases[q.case];
      if (q.case) shown[q.case] = 1;
      html += '<div class="card gq readq">' + gMeta(s, q, false) +
        gCaseHTML(cs, q) + gStemHTML(q) + gChoiceList(q) +
        '<details class="rv"><summary>답·해설 <b>' + esc(gAnswerStr(q)) + "</b></summary>" + gExplain(q) + "</details></div>";
    });
    html += "</div>";
    app().innerHTML = html;
    G.hydrate(app());
    document.querySelector(".opts .seg").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      gOpts[s.id] = gOpts[s.id] || { filter: "all", scope: "all", order: "new", grade: "instant", year: "all" };
      gOpts[s.id].order = b.dataset.v; viewGRead(s);
    };
    document.getElementById("openAll").onclick = function () {
      var open = this.dataset.open !== "1";
      document.querySelectorAll("details.rv").forEach(function (d) { d.open = open; });
      this.dataset.open = open ? "1" : "0";
      this.textContent = open ? "답·해설 전부 접기" : "답·해설 전부 펼치기";
    };
  }

  function viewEx() {
    document.title = "2025 시험 — 기출";
    var ex = G.ex();
    if (!ex) { app().innerHTML = '<a class="crumb" href="#/">← 홈</a><h1>2025 실제 시험지</h1>' + lockCard(); return; }
    var o = gOpts.EX = gOpts.EX || { grade: "exam" };
    var byP = {}, profs = [];
    ex.questions.forEach(function (q) { if (!byP[q.prof]) { byP[q.prof] = []; profs.push(q.prof); } byP[q.prof].push(q); });
    var st = stats(ex);
    var html = '<a class="crumb" href="#/g">← 기출 목록</a><h1>2025 실제 시험지</h1>' +
      '<p class="sub">작년 내분비 1차 시험 ' + ex.questions.length + "문항 (객관식·주관식). 교수별로 나눠 풀거나 통째로 풀 수 있어요. 올해 교수가 바뀐 과목은 참고만.</p>" +
      '<div class="card" style="margin-top:12px">' + lvBar(st) + lvLegend(st) + "</div>" +
      '<div class="card opts" style="margin-top:12px">' + seg("grade", "채점", [["exam", "시험처럼 (끝나고 채점)"], ["instant", "바로 확인"]], o.grade) + "</div>" +
      '<div class="btnrow" style="margin-top:12px"><button class="btn primary" data-p="*">전체 ' + ex.questions.length + "문항 풀기</button></div>" +
      '<h2>교수별</h2><div class="stack">';
    profs.forEach(function (p) {
      var qs = byP[p], ps = stats(ex, qs);
      var mc = qs.filter(function (q) { return q.type !== "short"; }).length;
      var lecs = {};
      qs.forEach(function (q) { var s = q.lecture && G.get(q.lecture); if (s) lecs[q.lecture] = s.title; });
      html += '<div class="card exrow"><div class="lmain"><div class="ltitle">' + esc(p) + " 교수님 <span class=\"meta\">객 " + mc + (qs.length - mc ? " · 주 " + (qs.length - mc) : "") + "</span></div>" +
        '<div class="meta">' + Object.keys(lecs).map(function (k) { return '<a href="#/g/' + encodeURIComponent(k) + '">' + esc(lecs[k]) + "</a>"; }).join(", ") + "</div>" +
        '<div style="margin-top:6px">' + lvBar(ps) + '</div></div><button class="btn" data-p="' + esc(p) + '">풀기</button></div>';
    });
    html += "</div>";
    app().innerHTML = html;
    document.querySelector(".opts .seg").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      o.grade = b.dataset.v;
      this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    };
    document.querySelectorAll("[data-p]").forEach(function (b) {
      b.onclick = function () {
        var qs = b.dataset.p === "*" ? ex.questions : byP[b.dataset.p];
        start(qs.map(function (q) { return { set: ex, q: q }; }), o.grade, "#/ex", "2025 시험");
      };
    });
  }

  function viewSearch(term) {
    document.title = "기출 검색 — 의대 OX";
    if (G.state() !== "ready") { app().innerHTML = '<a class="crumb" href="#/">← 홈</a><h1>기출 검색</h1>' + lockCard(); return; }
    app().innerHTML = '<a class="crumb" href="#/g">← 기출 목록</a><h1>기출 검색</h1>' +
      '<div class="tokenrow" style="margin-top:12px"><input id="sq" type="search" placeholder="예: Sheehan, 칼시토닌, ACTH 자극검사" value="' + esc(term) + '"></div>' +
      '<p class="note" id="sn"></p><div class="wlist" id="sr"></div>';
    var all = [];
    G.sets().concat([G.ex()]).forEach(function (s) { s.questions.forEach(function (q) { all.push({ set: s, q: q }); }); });
    var inp = document.getElementById("sq"), timer = null;
    function run() {
      var v = inp.value.trim().toLowerCase();
      history.replaceState(null, "", "#/search/" + encodeURIComponent(inp.value.trim()));
      var box = document.getElementById("sr");
      if (!v) { box.innerHTML = ""; document.getElementById("sn").textContent = "문제·해설·강의 이름에서 찾아요. 띄어쓰기로 여러 단어."; return; }
      var terms = v.split(/\s+/);
      var hit = all.filter(function (x) {
        var h = ((x.q.t || "") + " " + (x.q.key || "") + " " + (x.q.easy || "") + " " + (x.q.answerText || "") + " " + x.set.title).toLowerCase();
        return terms.every(function (t) { return h.indexOf(t) >= 0; });
      });
      document.getElementById("sn").textContent = hit.length + "문항" + (hit.length > 60 ? " (앞 60개만 보여요)" : "");
      box.innerHTML = hit.slice(0, 60).map(function (x, k) {
        return '<div class="card witem sres" data-k="' + k + '">' + gMeta(x.set, x.q, true) +
          '<p class="q">' + esc((x.q.t || "").slice(0, 160)) + "</p>" + (x.q.key ? '<p class="why">💡 ' + esc(x.q.key) + "</p>" : "") + "</div>";
      }).join("");
      box.querySelectorAll(".sres").forEach(function (el) {
        el.onclick = function () { var x = hit[+el.dataset.k]; start([x], "instant", "#/search/" + encodeURIComponent(inp.value.trim()), "검색"); };
      });
    }
    inp.oninput = function () { clearTimeout(timer); timer = setTimeout(run, 200); };
    run();
    inp.focus();
  }

  // ── 복습 칸 ───────────────────────────────────────
  // 풀다가 틀렸다·모르겠다로 남긴 것과 복습 날이 된 것을 모아 두고, 사용자가 골라서 복습한다
  var rvOpts = { scope: "all", order: "shuffle" };
  function lastGrade(r) { return r.g || (r.l === 0 ? (r.u && !r.w ? "unsure" : "wrong") : "know"); }
  function reviewPools() {
    var P = { due: [], wrong: [], unsure: [], star: [] };
    allSets().forEach(function (set) {
      if (rvOpts.scope === "g" && set.kind !== "g") return;
      if (rvOpts.scope === "ox" && set.kind === "g") return;
      set.questions.forEach(function (q) {
        var r = rec(set.id, q.id), x = { set: set, q: q, r: r };
        if (r) {
          if (isDue(set.id, q.id)) P.due.push(x);
          var g = lastGrade(r);
          if (g === "wrong") P.wrong.push(x); else if (g === "unsure") P.unsure.push(x);
        }
        if (isStar(set.id, q.id)) P.star.push(x);
      });
    });
    return P;
  }
  function reviewCount() { var P = reviewPools(); return P.due.length; }
  function startReview(list, title) {
    var items = list.map(function (x) { return { set: x.set, q: x.q }; });
    if (rvOpts.order === "shuffle") shuffle(items);
    start(items, "instant", "#/review", title);
  }

  function viewWrong() {
    document.title = "복습 — 의대 OX";
    var P = reviewPools();
    var html = '<h1>복습</h1><p class="sub">풀면서 <b>틀렸다</b>·<b>모르겠다</b>로 남긴 문제와, 간격이 돌아와 <b>오늘 복습할 차례</b>가 된 문제가 여기 모여요. 원하는 묶음을 골라 푸세요. 다시 풀어 ‘안다’가 되면 빠져요.</p>' +
      '<div class="card opts" style="margin-top:14px">' +
      seg("scope", "범위", [["all", "전부"], ["g", "기출만"], ["ox", "자작 OX만"]], rvOpts.scope) +
      seg("order", "순서", [["shuffle", "섞기"], ["seq", "강의 순서"]], rvOpts.order) + "</div>" +
      '<div class="rvgrid">' +
      rvBox("due", "오늘 복습 차례", "간격이 돌아온 문제", P.due.length) +
      rvBox("wrong", "틀렸다", "마지막에 틀린 문제", P.wrong.length) +
      rvBox("unsure", "모르겠다", "찍었거나 몰랐던 문제", P.unsure.length) +
      rvBox("star", "★ 별표", "직접 찍어 둔 문제", P.star.length) + "</div>";
    var up = upcoming(allSets());
    if (!P.due.length && up) html += '<p class="note" style="margin-top:8px">다음 복습: ' + dLabel(up.days) + " " + up.n + "문제</p>";

    // 강의·세트별로 틀렸다+모르겠다
    var by = {}, order = [];
    P.wrong.concat(P.unsure).forEach(function (x) {
      if (!by[x.set.id]) { by[x.set.id] = []; order.push(x.set.id); }
      by[x.set.id].push(x);
    });
    if (order.length) {
      html += '<h2>강의별 <span class="meta">틀렸다 + 모르겠다</span></h2><div class="stack">' + order.map(function (id) {
        var l = by[id], s = l[0].set;
        return '<div class="card exrow"><div class="lmain"><div class="ltitle">' + esc(s.title) + ' <span class="meta">' + esc(s.professor || "") + "</span></div>" +
          '<div class="meta">틀렸다 ' + l.filter(function (x) { return lastGrade(x.r) === "wrong"; }).length + " · 모르겠다 " + l.filter(function (x) { return lastGrade(x.r) === "unsure"; }).length + "</div></div>" +
          '<button class="btn" data-set="' + esc(id) + '">' + l.length + "문제 풀기</button></div>";
      }).join("") + "</div>";
      var list = P.wrong.concat(P.unsure).sort(function (a, b) { return (b.r.w + (b.r.u || 0)) - (a.r.w + (a.r.u || 0)) || b.r.t - a.r.t; });
      html += '<h2>문제 목록 <span class="meta">많이 틀린 순</span></h2><div class="wlist">' + list.map(function (w) {
        var gl = lastGrade(w.r) === "wrong" ? '<span class="pill memo">틀렸다</span>' : '<span class="pill ex">모르겠다</span>';
        return witem(w.set, w.q).replace('<p class="q">', '<p class="meta" style="margin:6px 0 0">' + gl + " " + esc(w.set.professor || "") + " · 틀림 " + w.r.w + "회" + (w.r.u ? " · 모름 " + w.r.u + "회" : "") + " · 맞음 " + w.r.c + '회</p><p class="q">');
      }).join("") + "</div>";
    } else html += '<p class="empty">틀렸다·모르겠다로 남은 문제가 없어요.</p>';
    app().innerHTML = html;
    G.hydrate(app());
    document.querySelectorAll(".opts .seg").forEach(function (g) {
      g.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        rvOpts[g.dataset.k] = b.dataset.v; viewWrong();
      };
    });
    var names = { due: "오늘 복습", wrong: "틀렸다 복습", unsure: "모르겠다 복습", star: "별표 복습" };
    document.querySelectorAll("[data-pool]").forEach(function (b) {
      b.onclick = function () { startReview(P[b.dataset.pool], names[b.dataset.pool]); };
    });
    document.querySelectorAll("[data-set]").forEach(function (b) {
      b.onclick = function () { startReview(by[b.dataset.set], by[b.dataset.set][0].set.title + " 복습"); };
    });
  }
  function rvBox(k, name, desc, n) {
    return '<div class="card rvbox rv-' + k + '"><div class="rvn">' + n + '</div><div class="rvname">' + name + '</div><p class="note">' + desc + "</p>" +
      '<button class="btn' + (k === "due" ? " primary" : "") + '" data-pool="' + k + '"' + (n ? "" : " disabled") + ">풀기</button></div>";
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

    html += '<h2>기출 잠금</h2><div class="card">';
    if (G.state() === "ready") {
      var gd = G.data();
      html += '<p style="margin-top:0"><b>열림</b> · 강의 ' + G.sets().length + "개 · 2025 시험 " + G.ex().questions.length + '문항<br><span class="note">데이터 만든 시각 ' + esc(gd.built) + "</span></p>" +
        '<div class="btnrow"><button class="btn ghost" id="gForget">이 기기에서 키 지우기</button></div>';
    } else {
      html += '<p style="margin-top:0">출족·작년 시험은 학교 자료라 공개 저장소에 <b>암호화</b>해서 올려 두었어요. 키를 한 번 넣으면 열리고, 동기화가 켜져 있으면 다른 기기에는 자동으로 전달돼요.</p>' +
        '<p class="note">키 위치: 공부 PC의 <b>OX퀴즈\\_build\\KEY.txt</b> (또는 동기화 gist의 med-ox-quiz-key.txt)</p>' +
        '<div class="tokenrow"><input id="gk" type="password" autocomplete="off" spellcheck="false" placeholder="기출 키"><button class="btn primary" id="gOpen">열기</button></div>' +
        '<p class="note" id="gMsg">' + (G.state() === "error" ? "오류: " + esc(G.err()) : "") + "</p>";
    }
    html += "</div>";

    html += '<h2>화면</h2><div class="card">' + seg("theme", "테마", [["auto", "기기 설정 따름"], ["light", "밝게"], ["dark", "어둡게"]], th) + "</div>" +
      '<h2>백업</h2><div class="card"><p class="note" style="margin-top:0">기록 파일로 내보내기·불러오기 (동기화와 별개, 지금 기록 ' + n + "문항)</p>" +
      '<div class="btnrow"><button class="btn" id="exp">내보내기 (.json)</button><button class="btn" id="imp">불러오기</button><input type="file" id="impFile" accept=".json,application/json" class="hidden"></div></div>' +
      '<h2>초기화</h2><div class="card"><p class="note" style="margin-top:0">동기화가 켜져 있으면 모든 기기에서 같이 지워져요.</p><div class="btnrow">' +
      ORDER.map(function (id) { return '<button class="btn ghost" data-reset="' + esc(id) + '">' + esc(SETS[id].professor + " · " + SETS[id].title) + " 기록 지우기</button>"; }).join("") +
      '<button class="btn danger" data-reset="*">전체 기록·별표 지우기</button></div></div>' +
      '<h2>기록 백업</h2><div class="card"><p class="note" style="margin-top:0">하루 한 번 기록을 이 기기에 따로 저장해 둬요(최근 7일). 기록이 사라졌으면 날짜를 골라 되살리세요 — 지금 기록과 합쳐지고, 더 최근에 푼 건 그대로 남아요.</p><div class="btnrow">' +
      (backups().length ? backups().map(function (d) { return '<button class="btn ghost" data-bak="' + esc(d) + '">' + esc(d) + " 되살리기</button>"; }).join("") : '<span class="note">아직 백업이 없어요.</span>') + "</div></div>" +
      '<h2>복습 규칙 (안키 방식)</h2><div class="card note">답을 보면 세 가지로 남아요. <b>안다</b>(맞혔고 확실): 다음 복습이 1 → 3 → 8 → 20일처럼 늘어남. <b>모르겠다</b>(찍었거나 몰랐음): 간격이 거의 안 늘고 복습 칸 ‘모르겠다’에 모임. <b>틀렸다</b>: 오늘 복습 차례가 되고 복습 칸 ‘틀렸다’에 모임. 복습 칸에서 골라 풀면 돼요. 자주 헷갈린 문제일수록 간격이 천천히 늘어요. 시험일 전날을 넘겨 미루지 않아요. 단계: 다시 익히는 중 · 학습 중(간격 3일 미만) · 익숙(10일 미만) · 완벽.</div>';
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
    var go = document.getElementById("gOpen");
    if (go) go.onclick = function () {
      var v = document.getElementById("gk").value;
      if (!v.trim()) return;
      go.disabled = true;
      document.getElementById("gMsg").textContent = "여는 중…";
      G.setPass(v).then(function () { viewSettings(); }).catch(function (e) {
        go.disabled = false;
        document.getElementById("gMsg").textContent = "못 열었어요: " + e.message;
      });
    };
    document.querySelectorAll("[data-bak]").forEach(function (b) {
      b.onclick = function () {
        try {
          var d = JSON.parse(localStorage.getItem(BAK + b.dataset.bak) || "null");
          if (!d) return;
          var before = Object.keys(store.r).length;
          merge(store, d); save();
          alert("되살렸어요. 기록 " + before + " → " + Object.keys(store.r).length + "문항");
          viewSettings();
        } catch (e) { alert("백업을 못 읽었어요."); }
      };
    });
    var gf = document.getElementById("gForget");
    if (gf) gf.onclick = function () { if (confirm("이 기기에서 기출 키를 지울까요? (기록은 남아요)")) { G.forget(); viewSettings(); } };
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
