/* 의대 OX 퀴즈 — 세트 파일(data/sets/*.js)이 QUIZ.register()로 문제를 등록하고,
   풀이 기록은 이 브라우저의 localStorage에만 저장한다. */
(function () {
  "use strict";

  var SETS = {};
  var ORDER = [];
  var KEY = "mox:v1";
  var store = load();
  var session = null;
  var setOpts = {};

  // ── 저장 ──────────────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var s = raw ? JSON.parse(raw) : {};
      return { r: s.r || {}, s: s.s || {}, last: s.last || null };
    } catch (e) { return { r: {}, s: {}, last: null }; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
  }
  function rec(setId, qid) { return store.r[setId + ":" + qid]; }
  function isStar(setId, qid) { return !!store.s[setId + ":" + qid]; }
  function toggleStar(setId, qid) {
    var k = setId + ":" + qid;
    if (store.s[k]) delete store.s[k]; else store.s[k] = 1;
    save();
  }
  function record(setId, qid, ok) {
    var k = setId + ":" + qid;
    var r = store.r[k] || { c: 0, w: 0 };
    if (ok) r.c++; else r.w++;
    r.l = ok ? 1 : 0;
    r.t = Date.now();
    store.r[k] = r;
  }

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
      if (i >= files.length) { window.addEventListener("hashchange", route); route(); return; }
      var s = document.createElement("script");
      s.src = files[i++];
      s.onload = next;
      s.onerror = function () { console.warn("세트 파일을 못 읽음:", s.src); next(); };
      document.body.appendChild(s);
    })();
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
    var m = /^(P\d+)\s*(\d+p)?/.exec(t.src || "");
    if (m && set.lectures[m[1]]) return set.lectures[m[1]].split("·")[0].trim() + (m[2] ? " " + m[2] : "");
    return t.src || "";
  }
  function stats(set, qs) {
    qs = qs || set.questions;
    var seen = 0, ok = 0, ng = 0;
    qs.forEach(function (q) {
      var r = rec(set.id, q.id);
      if (!r) return;
      seen++;
      if (r.l) ok++; else ng++;
    });
    return { total: qs.length, seen: seen, ok: ok, ng: ng };
  }
  function barHTML(st, cls) {
    return '<div class="bar ' + (cls || "") + '"><i class="ok" style="width:' + pct(st.ok, st.total) + '%"></i><i class="ng" style="width:' + pct(st.ng, st.total) + '%"></i></div>';
  }
  function setNav(which) {
    document.querySelectorAll(".navlink").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("href") === "#/" + which);
    });
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
  function viewHome() {
    document.title = "의대 OX 퀴즈";
    var html = '<h1>강조된 것만, OX로.</h1><p class="sub">교수님이 짚어 준 범위만 골라 만든 OX 퀴즈입니다. 기록은 이 기기에만 저장돼요.</p>';

    var last = store.last && SETS[store.last] ? SETS[store.last] : null;
    if (last) {
      var ls = stats(last);
      html += '<div class="card continue" style="margin-top:18px"><p>이어서 · <b>' + esc(last.professor) + '</b> ' + esc(last.title) + ' <span class="meta">(' + ls.seen + '/' + ls.total + ')</span></p><a class="btn primary" href="#/set/' + encodeURIComponent(last.id) + '">열기</a></div>';
    }

    var groups = {};
    var gorder = [];
    ORDER.forEach(function (id) {
      var s = SETS[id];
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
        html += '<a class="card setcard" href="#/set/' + encodeURIComponent(s.id) + '">' +
          '<div class="row"><h3>' + esc(s.title) + '</h3><span class="prof">' + esc(s.professor) + '</span></div>' +
          '<div class="meta">' + esc(s.date || "") + (s.slot ? " · " + esc(s.slot) : "") + ' · 강조 ' + s.focus.length + '곳 · ' + s.questions.length + '문항</div>' +
          '<div style="margin-top:10px">' + barHTML(st, "thin") + '</div>' +
          '<div class="statline"><span>푼 문제 <b>' + st.seen + '</b>/' + st.total + '</span><span>맞음 <b>' + st.ok + '</b></span><span>틀림 <b>' + st.ng + '</b></span></div>' +
          '</a>';
      });
      html += "</div>";
    });
    app().innerHTML = html;
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
      if (o.filter === "wrong") return r && r.l === 0;
      if (o.filter === "star") return isStar(set.id, q.id);
      return true;
    });
  }

  function viewSet(set) {
    document.title = set.professor + " · " + set.title + " — 의대 OX";
    store.last = set.id; save();
    var o = getOpts(set);
    var st = stats(set);

    var html = '<a class="crumb" href="#/">← 전체 세트</a>' +
      '<h1>' + esc(set.title) + '</h1>' +
      '<p class="sub">' + esc(set.subject) + ' · ' + esc(set.professor) + ' 교수님 · ' + esc(set.date || "") + (set.slot ? " " + esc(set.slot) : "") + '</p>' +
      '<div class="card" style="margin-top:16px">' + barHTML(st) +
      '<div class="statline"><span>푼 문제 <b>' + st.seen + '</b>/' + st.total + '</span><span>정답률 <b>' + pct(st.ok, st.seen) + '%</b></span><span>지금 틀린 상태 <b>' + st.ng + '</b></span></div></div>';

    html += '<h2>강조 범위</h2><div class="card"><ul class="focus">';
    set.focus.forEach(function (f) {
      var where = f.memo ? "시험정보" : (set.lectures[f.lec] || f.lec).split("·")[0].trim() + " " + f.page + "p";
      html += '<li><span class="where' + (f.memo ? " memo" : "") + '">' + esc(where) + '</span><span>' + esc(f.label) + '</span></li>';
    });
    html += '</ul>' + (set.examInfo ? '<div class="examinfo">' + esc(set.examInfo) + '</div>' : "") + '</div>';

    html += '<h2>핵심 정리 <span class="meta">— 풀기 전에 한 번 훑기</span></h2>';
    set.topics.forEach(function (t) {
      var ts = stats(set, set.questions.filter(function (q) { return q.t === t.id; }));
      html += '<details class="sum"><summary><b>' + esc(t.name) + '</b> <span class="pill ' + (t.memo ? "memo" : "src") + '">' + esc(t.memo ? "시험정보" : srcLabel(set, t)) + '</span>' +
        '<span class="acc">' + (ts.seen ? ts.ok + "/" + ts.total + " 맞음" : ts.total + "문항") + '</span></summary><ul>' +
        t.summary.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></details>";
    });

    html += '<h2>풀 범위 고르기</h2><div class="card opts">' +
      '<div><span class="opt-label">주제 <button class="chip" id="allTopics" style="padding:2px 10px;font-size:12px;margin-left:6px">전체 선택/해제</button></span><div class="chips" id="topicChips">' +
      set.topics.map(function (t) {
        var n = set.questions.filter(function (q) { return q.t === t.id; }).length;
        return '<button class="chip" data-t="' + esc(t.id) + '" aria-pressed="' + (o.topics.indexOf(t.id) >= 0) + '">' + esc(t.name) + ' <span class="n">' + n + '</span></button>';
      }).join("") + '</div></div>' +
      seg("filter", "문항", [["all", "전체"], ["unseen", "안 푼 것"], ["wrong", "틀린 것"], ["star", "★ 별표"]], o.filter) +
      seg("order", "순서", [["seq", "강의 순서"], ["shuffle", "섞기"]], o.order) +
      seg("grade", "채점", [["instant", "바로 확인"], ["exam", "시험처럼 (끝나고 채점)"]], o.grade) +
      '</div>';

    html += '<div class="startbar"><button class="btn primary block" id="startBtn"></button></div>';
    app().innerHTML = html;

    function refresh() {
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
      refresh();
    };
    document.getElementById("allTopics").onclick = function () {
      o.topics = o.topics.length === set.topics.length ? [] : set.topics.map(function (t) { return t.id; });
      document.querySelectorAll("#topicChips .chip").forEach(function (c) { c.setAttribute("aria-pressed", o.topics.indexOf(c.dataset.t) >= 0); });
      refresh();
    };
    document.querySelectorAll(".seg").forEach(function (g) {
      g.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        o[g.dataset.k] = b.dataset.v;
        g.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        refresh();
      };
    });
    document.getElementById("startBtn").onclick = function () {
      var qs = pickQuestions(set, o);
      if (o.order === "shuffle") qs = shuffle(qs.slice());
      start(qs.map(function (q) { return { set: set, q: q }; }), o.grade, "#/set/" + encodeURIComponent(set.id), set.title);
    };
    refresh();
  }
  function seg(k, label, items, cur) {
    return '<div><span class="opt-label">' + label + '</span><div class="seg" data-k="' + k + '">' +
      items.map(function (it) { return '<button data-v="' + it[0] + '" aria-pressed="' + (it[0] === cur) + '">' + it[1] + "</button>"; }).join("") +
      "</div></div>";
  }

  // ── 풀이 ──────────────────────────────────────────
  function start(items, grade, back, title) {
    session = { items: items, i: 0, ans: new Array(items.length), grade: grade, back: back, title: title, done: false };
    location.hash = "#/quiz";
    if (location.hash === "#/quiz") route();
  }

  function viewQuiz() {
    var S = session;
    if (S.done) { location.hash = "#/result"; return; }
    var it = S.items[S.i];
    var set = it.set, q = it.q, t = set.topicMap[q.t];
    var picked = S.ans[S.i];
    var revealed = S.grade === "instant" && picked !== undefined;
    var answered = S.ans.filter(function (a) { return a !== undefined; }).length;
    document.title = (S.i + 1) + "/" + S.items.length + " — 의대 OX";

    var html = '<div class="qtop"><a class="iconbtn" href="' + S.back + '" title="그만 풀기 (Esc)" aria-label="그만 풀기">✕</a>' +
      '<div class="bar"><i class="ok" style="width:' + pct(S.grade === "exam" ? answered : S.i + (revealed ? 1 : 0), S.items.length) + '%"></i></div>' +
      '<span class="count">' + (S.i + 1) + " / " + S.items.length + '</span>' +
      '<button class="iconbtn" id="starBtn" aria-pressed="' + isStar(set.id, q.id) + '" title="별표 (S)" aria-label="별표">★</button></div>';

    html += '<div class="card qcard"><div class="qmeta">' +
      '<span class="pill ' + (t && t.memo ? "memo" : "src") + '">' + esc(t ? t.name : "") + '</span>' +
      '<span class="pill">' + esc(t && t.memo ? "시험정보" : srcLabel(set, t)) + '</span>' +
      (session.items.some(function (x) { return x.set !== set; }) || session.back === "#/wrong" ? '<span class="pill">' + esc(set.professor) + '</span>' : "") +
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
      '<button class="' + cls(false) + '" data-v="0"' + (revealed ? " disabled" : "") + ' aria-label="X, 틀리다">X</button></div>';

    if (revealed) {
      var ok = picked === q.a;
      html += '<div class="verdict ' + (ok ? "ok" : "ng") + '"><div class="head">' + (ok ? "정답" : "오답") + ' · 답은 ' + (q.a ? "O" : "X") + '</div>' +
        (q.why ? "<p>" + esc(q.why) + "</p>" : "") + "</div>";
      html += '<div class="qnav"><button class="btn primary" id="nextBtn">' + (S.i + 1 < S.items.length ? "다음 →" : "결과 보기") + "</button></div>";
    }
    if (S.grade === "exam") {
      html += '<div class="qnav"><button class="btn ghost" id="prevBtn"' + (S.i ? "" : " disabled") + '>← 이전</button>' +
        (S.i + 1 < S.items.length ? '<button class="btn ghost" id="skipBtn">다음 →</button>' : "") +
        '<button class="btn primary" id="submitBtn">채점하기 (' + answered + "/" + S.items.length + ")</button></div>";
      html += '<div class="dots">' + S.items.map(function (_, k) {
        return '<button data-k="' + k + '" class="' + (S.ans[k] !== undefined ? "done " : "") + (k === S.i ? "cur" : "") + '">' + (k + 1) + "</button>";
      }).join("") + "</div>";
    }
    html += '<p class="kbd"><kbd>O</kbd>·<kbd>←</kbd> 맞다 &nbsp; <kbd>X</kbd>·<kbd>→</kbd> 틀리다 &nbsp; <kbd>Enter</kbd> 다음 &nbsp; <kbd>S</kbd> 별표</p>';
    app().innerHTML = html;

    function answer(v) {
      if (revealed) return;
      S.ans[S.i] = v;
      if (S.grade === "instant") {
        record(set.id, q.id, v === q.a); save();
        viewQuiz();
      } else {
        if (S.i + 1 < S.items.length) { S.i++; }
        viewQuiz();
      }
    }
    function next() {
      if (S.grade === "instant" && !revealed) return;
      if (S.i + 1 < S.items.length) { S.i++; viewQuiz(); window.scrollTo(0, 0); }
      else finish();
    }
    document.querySelectorAll(".oxbtn").forEach(function (b) { b.onclick = function () { answer(b.dataset.v === "1"); }; });
    var nb = document.getElementById("nextBtn"); if (nb) { nb.onclick = next; nb.focus({ preventScroll: true }); }
    document.getElementById("starBtn").onclick = function () { toggleStar(set.id, q.id); this.setAttribute("aria-pressed", isStar(set.id, q.id)); };
    var pb = document.getElementById("prevBtn"); if (pb) pb.onclick = function () { S.i--; viewQuiz(); };
    var sk = document.getElementById("skipBtn"); if (sk) sk.onclick = function () { S.i++; viewQuiz(); };
    var sb = document.getElementById("submitBtn");
    if (sb) sb.onclick = function () {
      var left = S.items.length - answered;
      if (left && !confirm(left + "문제를 안 풀었어요. 그래도 채점할까요? (안 푼 문제는 기록에 남지 않아요)")) return;
      S.items.forEach(function (x, k) { if (S.ans[k] !== undefined) record(x.set.id, x.q.id, S.ans[k] === x.q.a); });
      save(); finish();
    };
    document.querySelectorAll(".dots button").forEach(function (b) { b.onclick = function () { S.i = +b.dataset.k; viewQuiz(); }; });

    document.onkeydown = function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var c = e.code;
      if (c === "KeyO" || c === "ArrowLeft" || c === "Digit1" || c === "Numpad1") { e.preventDefault(); answer(true); }
      else if (c === "KeyX" || c === "ArrowRight" || c === "Digit2" || c === "Numpad2") { e.preventDefault(); answer(false); }
      else if (c === "Enter" || c === "Space") { if (revealed) { e.preventDefault(); next(); } }
      else if (c === "KeyS") { document.getElementById("starBtn").click(); }
      else if (c === "Escape") { location.hash = S.back; }
    };
  }

  function finish() {
    session.done = true;
    location.hash = "#/result";
  }

  // ── 결과 ──────────────────────────────────────────
  function viewResult() {
    var S = session;
    document.title = "결과 — 의대 OX";
    var tot = 0, ok = 0, byT = {}, wrong = [];
    S.items.forEach(function (x, k) {
      var a = S.ans[k];
      if (a === undefined) return;
      tot++;
      var key = x.set.id + "|" + x.q.t;
      byT[key] = byT[key] || { name: x.set.topicMap[x.q.t].name, ok: 0, n: 0 };
      byT[key].n++;
      if (a === x.q.a) { ok++; byT[key].ok++; } else wrong.push({ x: x, a: a });
    });
    var p = pct(ok, tot);
    var html = '<a class="crumb" href="' + S.back + '">← ' + esc(S.title) + '</a><h1>결과</h1>' +
      '<div class="card score" style="margin-top:12px"><div class="ring" style="--p:' + p + '"><span>' + p + '%</span></div>' +
      '<div><div style="font-size:18px;font-weight:700">' + ok + " / " + tot + ' 맞음</div><p class="sub">' +
      (tot < S.items.length ? (S.items.length - tot) + "문제는 건너뜀 · " : "") +
      (wrong.length ? "틀린 " + wrong.length + "문제는 오답노트에 모였어요." : "전부 맞혔어요!") + "</p></div></div>";

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
      (wrong.length ? '<button class="btn primary" id="retryWrong">틀린 ' + wrong.length + "문제 다시</button>" : "") +
      '<button class="btn" id="retryAll">처음부터 다시</button><a class="btn ghost" href="' + S.back + '" style="text-decoration:none">돌아가기</a></div>';

    if (wrong.length) {
      html += '<h2>틀린 문제</h2><div class="wlist">' + wrong.map(function (w) { return witem(w.x.set, w.x.q, w.a); }).join("") + "</div>";
    }
    app().innerHTML = html;
    var rw = document.getElementById("retryWrong");
    if (rw) rw.onclick = function () { start(wrong.map(function (w) { return w.x; }), S.grade, S.back, S.title); };
    document.getElementById("retryAll").onclick = function () { start(S.items.slice(), S.grade, S.back, S.title); };
  }

  function witem(set, q, picked) {
    var t = set.topicMap[q.t];
    return '<div class="card witem"><div class="qmeta"><span class="pill src">' + esc(t.name) + '</span><span class="pill">' + esc(t.memo ? "시험정보" : srcLabel(set, t)) + "</span>" +
      (q.ex ? '<span class="pill ex">기출 ' + esc(q.ex) + "</span>" : "") + "</div>" +
      '<p class="q">' + esc(q.q) + "</p>" +
      '<div class="ans">정답 <b class="' + (q.a ? "o" : "x") + '">' + (q.a ? "O" : "X") + "</b>" +
      (picked !== undefined ? ' · 내 답 <b class="' + (picked ? "o" : "x") + '">' + (picked ? "O" : "X") + "</b>" : "") + "</div>" +
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
    wrong.sort(function (a, b) { return b.r.w - a.r.w || b.r.t - a.r.t; });
    var html = '<h1>오답노트</h1><p class="sub">마지막으로 풀었을 때 틀린 문제만 모읍니다. 다시 맞히면 자동으로 빠져요.</p>';
    html += '<div class="btnrow" style="margin-top:14px">' +
      '<button class="btn primary" id="doWrong"' + (wrong.length ? "" : " disabled") + ">오답 " + wrong.length + "문제 섞어서 풀기</button>" +
      '<button class="btn" id="doStar"' + (stars.length ? "" : " disabled") + ">★ 별표 " + stars.length + "문제 풀기</button></div>";
    if (!wrong.length) html += '<p class="empty">지금 틀린 상태인 문제가 없어요.</p>';
    else html += '<h2>틀린 문제 <span class="meta">많이 틀린 순</span></h2><div class="wlist">' + wrong.map(function (w) {
      return witem(w.set, w.q).replace('<p class="q">', '<p class="meta" style="margin:6px 0 0">' + esc(w.set.professor) + " · 틀림 " + w.r.w + "회 · 맞음 " + w.r.c + '회</p><p class="q">');
    }).join("") + "</div>";
    app().innerHTML = html;
    var mk = function (arr) { return shuffle(arr.map(function (w) { return { set: w.set, q: w.q }; })); };
    var dw = document.getElementById("doWrong");
    dw.onclick = function () { start(mk(wrong), "instant", "#/wrong", "오답노트"); };
    document.getElementById("doStar").onclick = function () { start(mk(stars), "instant", "#/wrong", "오답노트"); };
  }

  // ── 설정 ──────────────────────────────────────────
  function viewSettings() {
    document.title = "설정 — 의대 OX";
    var th = document.documentElement.dataset.theme || "auto";
    var n = Object.keys(store.r).length;
    var html = '<h1>설정</h1>' +
      '<h2>화면</h2><div class="card">' + seg("theme", "테마", [["auto", "기기 설정 따름"], ["light", "밝게"], ["dark", "어둡게"]], th) + "</div>" +
      '<h2>기록 옮기기</h2><div class="card"><p class="note" style="margin-top:0">기록은 이 브라우저에만 있어요. 폰↔노트북으로 옮기려면 파일로 내보낸 뒤 다른 기기에서 불러오세요. (지금 기록 ' + n + "문항)</p>" +
      '<div class="btnrow"><button class="btn" id="exp">기록 내보내기 (.json)</button><button class="btn" id="imp">기록 불러오기</button><input type="file" id="impFile" accept=".json,application/json" class="hidden"></div></div>' +
      '<h2>초기화</h2><div class="card"><div class="btnrow">' +
      ORDER.map(function (id) { return '<button class="btn ghost" data-reset="' + esc(id) + '">' + esc(SETS[id].professor + " · " + SETS[id].title) + " 기록 지우기</button>"; }).join("") +
      '<button class="btn danger" data-reset="*">전체 기록·별표 지우기</button></div></div>' +
      '<h2>정보</h2><div class="card note">강조 범위는 각 세트 화면에 출처(강의록 쪽수·시험정보 메모)와 함께 적어 두었습니다. 문제가 이상하면 세트 파일에서 고치면 돼요.</div>';
    app().innerHTML = html;

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
        // 같은 문항은 더 최근에 푼 기록을 남긴다
        Object.keys(d.r).forEach(function (k) { var a = store.r[k], b = d.r[k]; if (!a || (b.t || 0) > (a.t || 0)) store.r[k] = b; });
        Object.keys(d.s || {}).forEach(function (k) { store.s[k] = 1; });
        save(); alert("불러왔어요."); viewSettings();
      }).catch(function () { alert("이 파일은 퀴즈 기록 파일이 아니에요."); });
    };
    document.querySelectorAll("[data-reset]").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.reset;
        if (!confirm(id === "*" ? "모든 기록과 별표를 지울까요?" : "이 세트의 기록과 별표를 지울까요?")) return;
        [store.r, store.s].forEach(function (m) { Object.keys(m).forEach(function (k) { if (id === "*" || k.indexOf(id + ":") === 0) delete m[k]; }); });
        if (id === "*" || store.last === id) store.last = null;
        save(); viewSettings();
      };
    });
  }

  window.QUIZ = { register: register, boot: boot };
})();
