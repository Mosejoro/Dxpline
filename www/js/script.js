const CATS = ["quick", "moderate", "deep", "resist"];
const CN = {
  quick: "Easy Mode",
  moderate: "Moderately Hard",
  deep: "Deep Workings",
  resist: "Hard Tasks",
};
const CC = {
  quick: "var(--quick)",
  moderate: "var(--mod)",
  deep: "var(--deep)",
  resist: "var(--resist)",
};
const XP = { quick: 1, moderate: 3, deep: 5, resist: 8 };
const LVL = [0, 20, 50, 100, 175, 280, 420, 600, 840, 1150, 1600];

let tasks = [],
  hist = {},
  totalXP = 0,
  streak = 0,
  selC = "quick",
  view = "today",
  dragId = null;

const load = () => {
  tasks = JSON.parse(localStorage.getItem("fw3-t") || "[]");
  hist = JSON.parse(localStorage.getItem("fw3-h") || "{}");
  totalXP = +localStorage.getItem("fw3-xp") || 0;
  streak = +localStorage.getItem("fw3-s") || 0;
};
const save = () => {
  localStorage.setItem("fw3-t", JSON.stringify(tasks));
  localStorage.setItem("fw3-h", JSON.stringify(hist));
  localStorage.setItem("fw3-xp", totalXP);
  localStorage.setItem("fw3-s", streak);
  if (window.refreshReminder) window.refreshReminder();
  if (window.pushCloudSync) window.pushCloudSync();
};
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const tod = () => new Date().toISOString().slice(0, 10);
const wk = (d = tod()) => {
  const dt = new Date(d),
    dy = dt.getDay(),
    df = dy === 0 ? -6 : 1 - dy;
  dt.setDate(dt.getDate() + df);
  return dt.toISOString().slice(0, 10);
};
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toast = (msg) => {
  const e = document.getElementById("toast");
  e.textContent = msg;
  e.classList.add("show");
  setTimeout(() => e.classList.remove("show"), 2100);
};

function xpFloat(x, y, n, col) {
  const e = document.createElement("div");
  e.className = "xpf";
  e.textContent = `+${n} XP`;
  e.style.cssText = `left:${x}px;top:${y}px;color:${col}`;
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 800);
}

function selCat(c) {
  selC = c;
  document.querySelectorAll(".cgbtn").forEach((b) => {
    b.className = "cgbtn";
    if (b.dataset.c === c)
      b.classList.add(
        { quick: "sq", moderate: "sm", deep: "sd", resist: "sr" }[c],
      );
  });
}

function addTask() {
  const t = document.getElementById("ti").value.trim();
  if (!t) {
    toast("Enter a task first");
    return;
  }
  tasks.unshift({
    id: uid(),
    title: t,
    cat: selC,
    time: document.getElementById("tsel").value,
    urgent: document.getElementById("ucb").checked,
    done: false,
    created: tod(),
    completedOn: null,
  });
  save();
  document.getElementById("ti").value = "";
  document.getElementById("tsel").value = "";
  document.getElementById("ucb").checked = false;
  document.getElementById("uchip").classList.remove("on");
  renderAll();
  toast("Task added");
}

function setView(v, btn) {
  view = v;
  document
    .querySelectorAll(".vseg button")
    .forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
  renderAll();
}

function vis() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return view === "today" ? t.created === tod() : t.created >= wk();
  });
}

function renderBoard() {
  const vt = vis();
  CATS.forEach((c) => {
    const col = vt.filter((t) => t.cat === c);
    document.getElementById(`cnt-${c}`).textContent =
      col.filter((t) => !t.done).length || "";
    const body = document.getElementById(`body-${c}`);
    if (!col.length) {
      body.innerHTML = `<div class="empty">No ${CN[c].toLowerCase()} tasks</div>`;
      return;
    }
    body.innerHTML = "";
    col.forEach((t) => {
      const el = document.createElement("div");
      el.className = `card${t.done ? " done" : ""}${t.urgent ? " urgent" : ""}`;
      el.draggable = !t.done;
      el.dataset.id = t.id;
      el.innerHTML = `<div class="ctitle">${esc(t.title)}</div>
        <div class="cmeta">
          ${t.time ? `<span class="ctime">${t.time}</span>` : ""}
          <span class="cxp">+${XP[c]}xp</span>
          <div class="cacts">
            <button class="cbtn ok" onclick="tDone('${t.id}',event)">${t.done ? "↩" : "✓"}</button>
            <button class="cbtn dl" onclick="delT('${t.id}')">×</button>
          </div>
        </div>`;
      el.addEventListener("dragstart", () => {
        dragId = t.id;
        setTimeout(() => el.classList.add("dragging"), 0);
      });
      el.addEventListener("dragend", () => {
        dragId = null;
        el.classList.remove("dragging");
        document
          .querySelectorAll(".colbody")
          .forEach((b) => b.classList.remove("dov"));
      });
      body.appendChild(el);
    });
  });
}

function dov(e, c) {
  e.preventDefault();
  document.getElementById(`body-${c}`).classList.add("dov");
}
function dop(e, c) {
  e.preventDefault();
  document
    .querySelectorAll(".colbody")
    .forEach((b) => b.classList.remove("dov"));
  if (!dragId) return;
  const t = tasks.find((x) => x.id === dragId);
  if (!t || t.cat === c) return;
  t.cat = c;
  save();
  renderAll();
  toast(`→ ${CN[c]}`);
}

function tDone(id, e) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.completedOn = t.done ? tod() : null;
  if (t.done) {
    const d = tod();
    if (!hist[d])
      hist[d] = {
        quick: 0,
        moderate: 0,
        deep: 0,
        resist: 0,
        total: 0,
        xp: 0,
      };
    hist[d][t.cat]++;
    hist[d].total++;
    const g = XP[t.cat];
    hist[d].xp = (hist[d].xp || 0) + g;
    totalXP += g;
    recStreak();
    if (e) xpFloat(e.clientX - 20, e.clientY - 30, g, CC[t.cat]);
    toast(`+${g} XP`);
  } else {
    const d = tod();
    if (hist[d]) {
      hist[d][t.cat] = Math.max(0, (hist[d][t.cat] || 0) - 1);
      hist[d].total = Math.max(0, (hist[d].total || 0) - 1);
      const g = XP[t.cat];
      hist[d].xp = Math.max(0, (hist[d].xp || 0) - g);
      totalXP = Math.max(0, totalXP - g);
    }
    toast("Marked incomplete");
  }
  save();
  renderAll();
}

function delT(id) {
  tasks = tasks.filter((x) => x.id !== id);
  save();
  renderAll();
}

function recStreak() {
  let s = 0,
    cur = new Date();
  while (s < 365) {
    const k = cur.toISOString().slice(0, 10);
    if (hist[k]?.total > 0) {
      s++;
      cur.setDate(cur.getDate() - 1);
    } else break;
  }
  streak = s;
  save();
}

function dscore(vt) {
  const d = vt.filter((t) => t.done),
    n = vt.length;
  if (!n) return 0;
  return Math.min(
    100,
    Math.round(
      (d.length / n) * 60 +
        d.filter((t) => t.cat === "resist").length * 15 +
        d.filter((t) => t.cat === "deep").length * 8,
    ),
  );
}

function renderStats() {
  const vt = vis();
  const done = vt.filter((t) => t.done).length,
    total = vt.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const txp = hist[tod()]?.xp || 0;

  document.getElementById("rdone").textContent = done;
  document.getElementById("rpend").textContent = total - done;
  document.getElementById("rxp").textContent = txp;

  const pb = document.getElementById("pctbar");
  document.getElementById("pctlbl").textContent = pct + "%";
  pb.style.width = pct + "%";
  pb.style.background =
    pct < 30 ? "var(--resist)" : pct < 70 ? "var(--mod)" : "var(--quick)";

  const ds = dscore(vt);
  document.getElementById("dsn").textContent = ds;
  const db = document.getElementById("dsb");
  db.style.width = ds + "%";
  db.style.background =
    ds < 30
      ? "var(--resist)"
      : ds < 60
        ? "var(--mod)"
        : ds < 85
          ? "var(--deep)"
          : "var(--quick)";

  const lv = LVL.reduce((a, v, i) => (totalXP >= v ? i + 1 : a), 1);
  const lxp = LVL[Math.min(lv - 1, LVL.length - 1)],
    nxp = LVL[Math.min(lv, LVL.length - 1)];
  const xin = totalXP - lxp,
    xnd = nxp - lxp,
    xp = xnd > 0 ? Math.round((xin / xnd) * 100) : 100;
  document.getElementById("xplvl").textContent = `Lv ${lv}`;
  document.getElementById("xpfill").style.width = xp + "%";
  document.getElementById("xpfill").style.background =
    lv >= 7 ? "var(--resist)" : lv >= 4 ? "var(--deep)" : "var(--quick)";
  document.getElementById("xpsub").textContent =
    `${xin} / ${xnd} XP to Lv ${lv + 1}`;

  document.getElementById("stnum").textContent = streak;
  document.getElementById("stsub").textContent =
    streak === 0
      ? "No streak yet"
      : streak < 3
        ? "Building\nmomentum"
        : streak < 7
          ? "Getting\nconsistent"
          : "Strong\ndiscipline";

  const ws = wk();
  let wr = 0;
  Object.entries(hist).forEach(([d, v]) => {
    if (d >= ws) wr += v.resist || 0;
  });
  document.getElementById("rmf").style.width =
    Math.max(3, Math.min(100, wr * 12)) + "%";
  document.getElementById("rmn").textContent = wr;
  document.getElementById("rmsub").textContent =
    wr === 0
      ? "No Hard tasks completed this week."
      : wr < 3
        ? `${wr} Hard task${wr > 1 ? "s" : ""} done — keep pressing.`
        : `${wr} Hard tasks this week. You are training the right thing.`;

  const cr = document.getElementById("catrows");
  cr.innerHTML = "";
  CATS.forEach((c) => {
    const ct = vt.filter((t) => t.cat === c),
      cd = ct.filter((t) => t.done).length;
    const pp = ct.length ? Math.round((cd / ct.length) * 100) : 0;
    cr.innerHTML += `<div class="citem"><div class="citop"><span class="ciname" style="color:${CC[c]}">${CN[c]}</span><span class="cifrac">${cd}/${ct.length}</span></div><div class="pbar"><div class="pfill" style="width:${pp}%;background:${CC[c]}"></div></div></div>`;
  });

  // heatmap
  const hg = document.getElementById("hmg");
  hg.innerHTML = "";
  const now = new Date(),
    dow = now.getDay(),
    tom = dow === 0 ? 6 : dow - 1;
  const st = new Date(now);
  st.setDate(now.getDate() - tom - 21);
  for (let i = 0; i < 28; i++) {
    const d = new Date(st);
    d.setDate(st.getDate() + i);
    const dk = d.toISOString().slice(0, 10);
    const ron = tasks.filter(
      (t) => t.cat === "resist" && t.created === dk,
    ).length;
    const don = hist[dk]?.resist || 0;
    const av = Math.max(0, ron - don);
    const h = av >= 3 ? 1 : av >= 2 ? 0.65 : av >= 1 ? 0.35 : 0;
    const c = document.createElement("div");
    c.className = "hmc";
    c.style.background = h > 0 ? `rgba(239,68,68,${h * 0.85})` : "var(--bg3)";
    if (dk === tod()) c.style.outline = "1px solid var(--bdr2)";
    c.title = `${dk}: ${av} avoided`;
    hg.appendChild(c);
  }

  // reflection
  const wt = tasks.filter((t) => t.created >= ws),
    wd = wt.filter((t) => t.done);
  const cd2 = {},
    ct2 = {};
  CATS.forEach((c) => {
    cd2[c] = 0;
    ct2[c] = 0;
  });
  wt.forEach((t) => ct2[t.cat]++);
  wd.forEach((t) => cd2[t.cat]++);
  const av2 = CATS.reduce((a, b) => {
    const ar = ct2[a] > 0 ? cd2[a] / ct2[a] : 1,
      br = ct2[b] > 0 ? cd2[b] / ct2[b] : 1;
    return ar < br ? a : b;
  });
  const td = CATS.reduce((a, b) => (cd2[a] >= cd2[b] ? a : b));
  const wxp = Object.entries(hist)
    .filter(([d]) => d >= ws)
    .reduce((s, [, v]) => s + (v.xp || 0), 0);
  document.getElementById("refl").innerHTML = `
    <div class="rrow"><span class="rk">Most avoided</span><span class="rv" style="color:${CC[av2]}">${ct2[av2] > 0 ? CN[av2] : "—"}</span></div>
    <div class="rrow"><span class="rk">Most completed</span><span class="rv" style="color:${CC[td]}">${cd2[td] > 0 ? CN[td] : "—"}</span></div>
    <div class="rrow"><span class="rk">Done this week</span><span class="rv">${wd.length}</span></div>
    <div class="rrow"><span class="rk">XP this week</span><span class="rv" style="color:var(--deep)">${wxp}</span></div>
    <div class="rrow"><span class="rk">Discipline score</span><span class="rv" style="color:${ds < 40 ? "var(--resist)" : ds < 70 ? "var(--mod)" : "var(--quick)"}">${ds}/100</span></div>`;

  // signal
  const sg = genSig(vt, wt, wd, wr, pct, ds);
  ["sigtag", "lsigtag"].forEach((id) => {
    const e = document.getElementById(id);
    e.className = `sigtag ${sg.cls}`;
    e.textContent = sg.tag;
  });
  ["sigtext", "lsigtext"].forEach(
    (id) => (document.getElementById(id).textContent = sg.text),
  );
}

function genSig(vt, wt, wd, wr, pct, ds) {
  const rp = vt.filter((t) => t.cat === "resist" && !t.done).length;
  const qd = vt.filter((t) => t.cat === "quick" && t.done).length;
  const dd = vt.filter((t) => t.cat === "deep" && t.done).length;
  const dp = vt.filter((t) => t.cat === "deep" && !t.done).length;
  if (!vt.length)
    return {
      cls: "note",
      tag: "observation",
      text: "Add tasks to start building your discipline profile.",
    };
  if (pct === 100)
    return {
      cls: "ok",
      tag: "complete",
      text: `All tasks done. Discipline score: ${ds}/100. Note what made today work.`,
    };
  if (rp > 3)
    return {
      cls: "warn",
      tag: "avoidance pattern",
      text: `${rp} Hard tasks are sitting untouched. Avoidance is always a choice you keep making.`,
    };
  if (rp > 1)
    return {
      cls: "warn",
      tag: "hard tasks signal",
      text: "Hard tasks are being delayed. These are the ones that deeply change things even though they are not always visible at first.",
    };
  if (qd > 3 && dp > 0)
    return {
      cls: "info",
      tag: "drift pattern",
      text: "You complete Quick tasks smoothly. Deep Work still pending. That is productive feeling avoidance.",
    };
  if (dd > 0)
    return {
      cls: "ok",
      tag: "strong session",
      text: `Deep Work completed today. That earns ${XP.deep} XP per task — harder to earn, harder to skip.`,
    };
  if (wr > 5)
    return {
      cls: "ok",
      tag: "weekly signal",
      text: `${wr} Hard tasks done this week. You are training the part of you that avoids.`,
    };
  if (ds > 80)
    return {
      cls: "ok",
      tag: "high discipline",
      text: `Discipline score ${ds}/100. Strong output. Sustain this through the week.`,
    };
  if (pct < 20 && vt.length > 3)
    return {
      cls: "warn",
      tag: "low momentum",
      text: "Completion is low. Pick one task and finish it. Momentum starts with a single action.",
    };
  if (streak >= 7)
    return {
      cls: "ok",
      tag: "streak",
      text: `${streak}-day streak. Consistency is rarer than motivation. Don't break the chain.`,
    };
  return {
    cls: "note",
    tag: "observation",
    text: "Your behavior is being recorded. Patterns take days, not hours, to appear.",
  };
}

function renderAll() {
  renderBoard();
  renderStats();
}

load();
selCat("quick");
document.getElementById("dlbl").textContent = new Date().toLocaleDateString(
  "en-US",
  {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
);
recStreak();

if (!tasks.length) {
  const d = tod();
  tasks = [
    {
      id: uid(),
      title: "Reply to pending emails",
      cat: "quick",
      time: "",
      urgent: false,
      done: false,
      created: d,
      completedOn: null,
    },
    {
      id: uid(),
      title: "Drink 2L of water",
      cat: "quick",
      time: "",
      urgent: false,
      done: true,
      created: d,
      completedOn: d,
    },
    {
      id: uid(),
      title: "Review and organize week's notes",
      cat: "moderate",
      time: "",
      urgent: false,
      done: false,
      created: d,
      completedOn: null,
    },
    {
      id: uid(),
      title: "Build the portfolio landing page",
      cat: "deep",
      time: "",
      urgent: true,
      done: false,
      created: d,
      completedOn: null,
    },
    {
      id: uid(),
      title: "Study for Friday's exam",
      cat: "deep",
      time: "",
      urgent: true,
      done: false,
      created: d,
      completedOn: null,
    },
    {
      id: uid(),
      title: "Go to the gym",
      cat: "resist",
      time: "",
      urgent: false,
      done: false,
      created: d,
      completedOn: null,
    },
    {
      id: uid(),
      title: "Wash Clothes",
      cat: "resist",
      time: "",
      urgent: false,
      done: false,
      created: d,
      completedOn: null,
    },
  ];
  // seed one completion for XP demo
  const dh = tod();
  hist[dh] = {
    quick: 1,
    moderate: 0,
    deep: 0,
    resist: 0,
    total: 1,
    xp: 1,
  };
  totalXP = 1;
  save();
}
renderAll();