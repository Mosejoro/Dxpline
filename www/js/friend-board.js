// ── Dxpline friend board (read-only) ──
// Shows a connected friend's board/streak/level, fetched live from their
// private users/{uid} doc — readable only because Firestore's security rules
// grant read access to accepted friends specifically (see SETUP.md). Never
// editable from here; no add/complete/delete/drag wired up at all.
//
// Small constant set duplicated from script.js rather than loading it, since
// script.js is built around local interactive state (tasks/hist variables,
// addTask, drag handlers) this read-only page has no use for. Keep these in
// sync with script.js's CATS/CN/XP/LVL if those ever change.

const FB_CATS = ["quick", "moderate", "deep", "resist"];
const FB_CN = {
  quick: "Easy Mode",
  moderate: "Moderately Hard",
  deep: "Deep Workings",
  resist: "Hard Tasks",
};
const FB_XP = { quick: 1, moderate: 3, deep: 5, resist: 8 };
const FB_LVL = [0, 20, 50, 100, 175, 280, 420, 600, 840, 1150, 1600];

function fbGetQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function fbLevelFromXP(xp) {
  let lvl = 1;
  for (let i = 0; i < FB_LVL.length; i++) {
    if (xp >= FB_LVL[i]) lvl = i + 1;
  }
  return lvl;
}

function fbEsc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : s;
  return d.innerHTML;
}

function renderFriendBoard(publicData, privateData) {
  document.getElementById("fbAvatar").src =
    (publicData && publicData.photo) || "img/default.png";
  document.getElementById("fbName").textContent =
    (publicData && publicData.name) || "—";

  if (!privateData) {
    document.getElementById("fbError").style.display = "block";
    document.getElementById("fbContent").style.display = "none";
    return;
  }

  const tasks = privateData.tasks || [];
  const streak = privateData.streak || 0;
  const xp = privateData.totalXP || 0;

  document.getElementById("fbStreak").textContent = streak;
  document.getElementById("fbLevel").textContent = "Lv " + fbLevelFromXP(xp);
  document.getElementById("fbXp").textContent = xp + " XP";

  FB_CATS.forEach((c) => {
    const col = tasks.filter((t) => t.cat === c);
    const body = document.getElementById(`fb-body-${c}`);
    document.getElementById(`fb-cnt-${c}`).textContent =
      col.filter((t) => !t.done).length || "";

    if (!col.length) {
      body.innerHTML = `<div class="empty">No ${FB_CN[c].toLowerCase()} tasks</div>`;
      return;
    }
    body.innerHTML = col
      .map(
        (t) => `
      <div class="card${t.done ? " done" : ""}${t.urgent ? " urgent" : ""}">
        <div class="ctitle">${fbEsc(t.title)}</div>
        <div class="cmeta">
          ${t.time ? `<span class="ctime">${fbEsc(t.time)}</span>` : ""}
          <span class="cxp">+${FB_XP[c]}xp</span>
        </div>
      </div>`,
      )
      .join("");
  });
}

let fbLatestPublic = null;
let fbLatestPrivate = null;
let fbGotPrivate = false;

function fbRenderIfReady() {
  if (fbGotPrivate) renderFriendBoard(fbLatestPublic, fbLatestPrivate);
}

function initFriendBoard() {
  const uid = fbGetQueryParam("uid");
  if (!uid) {
    document.getElementById("fbError").textContent = "No user specified.";
    document.getElementById("fbError").style.display = "block";
    document.getElementById("fbContent").style.display = "none";
    return;
  }

  onWebAuthReady(() => {
    fsListenDoc("users_public", uid, (data) => {
      fbLatestPublic = data;
      fbRenderIfReady();
    });
    fsListenDoc("users", uid, (data) => {
      fbLatestPrivate = data;
      fbGotPrivate = true;
      fbRenderIfReady();
    });
  });
}

// If deviceready already fired before this script ran, window.FirebasePlugin
// is already there — run immediately rather than waiting for an event that
// already happened (which would never fire again).
if (window.cordova && !window.FirebasePlugin) {
  document.addEventListener("deviceready", initFriendBoard);
} else {
  initFriendBoard();
}
