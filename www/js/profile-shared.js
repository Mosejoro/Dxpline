// ── Shared profile data helpers ──
// Used by both js/profile.js (the compact panel on index.html) and
// js/profile-full.js (the standalone profile.html, loaded in an iframe).
// Both pages share localStorage since they're served from the same origin.

const PROFILE_LVL = [0, 20, 50, 100, 175, 280, 420, 600, 840, 1150, 1600]; // keep in sync with script.js LVL

function profileKey(uid) {
  return `dxpline-profile-${uid}`;
}

function getCurrentUser() {
  const raw = localStorage.getItem("dxpline-user");
  return raw ? JSON.parse(raw) : null;
}

function loadProfile() {
  const u = getCurrentUser();
  if (!u)
    return {
      name: "",
      photo: "img/default.png",
      font: "default",
      theme: "default",
    };
  const raw = localStorage.getItem(profileKey(u.uid));
  const stored = raw ? JSON.parse(raw) : {};
  return {
    name: stored.name || u.name || "",
    photo: stored.photo || "img/default.png",
    font: stored.font || "default",
    theme: stored.theme || "default",
  };
}

function saveProfile(partial) {
  const u = getCurrentUser();
  if (!u) return;
  const merged = { ...loadProfile(), ...partial };
  localStorage.setItem(profileKey(u.uid), JSON.stringify(merged));
  triggerCloudSync();
  if (typeof pushPublicProfile === "function") pushPublicProfile();
  return merged;
}

// Works whether this runs directly on index.html or inside profile.html's iframe.
function triggerCloudSync() {
  if (typeof window.pushCloudSync === "function") {
    window.pushCloudSync();
  } else if (
    window.parent &&
    window.parent !== window &&
    typeof window.parent.pushCloudSync === "function"
  ) {
    window.parent.pushCloudSync();
  }
}

function getHist() {
  return JSON.parse(localStorage.getItem("fw3-h") || "{}");
}

function longestStreak() {
  const hist = getHist();
  const days = Object.keys(hist)
    .filter((d) => hist[d]?.total > 0)
    .sort();
  if (!days.length) return { count: 0, start: null, end: null };

  let bestLen = 1,
    bestStart = days[0],
    bestEnd = days[0];
  let curLen = 1,
    curStart = days[0];

  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i]) - new Date(days[i - 1])) / 86400000;
    if (diff === 1) {
      curLen++;
    } else {
      curLen = 1;
      curStart = days[i];
    }
    if (curLen > bestLen) {
      bestLen = curLen;
      bestStart = curStart;
      bestEnd = days[i];
    }
  }
  return { count: bestLen, start: bestStart, end: bestEnd };
}

function currentStreak() {
  return +localStorage.getItem("fw3-s") || 0;
}

function getTotalXP() {
  return +localStorage.getItem("fw3-xp") || 0;
}

function levelInfo() {
  const xp = getTotalXP();
  let lvl = 1;
  for (let i = 0; i < PROFILE_LVL.length; i++) {
    if (xp >= PROFILE_LVL[i]) lvl = i + 1;
  }
  const curFloor = PROFILE_LVL[lvl - 1] ?? 0;
  const nextCeil = PROFILE_LVL[lvl] ?? curFloor;
  return { level: lvl, xp, curFloor, nextCeil };
}

function categoryTotals() {
  const hist = getHist();
  const totals = { quick: 0, moderate: 0, deep: 0, resist: 0 };
  Object.values(hist).forEach((day) => {
    Object.keys(totals).forEach((cat) => {
      totals[cat] += day[cat] || 0;
    });
  });
  return totals;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PHOTO_COMPLIMENTS = [
  "Photo added — looking good!",
  "Nice choice — photo updated!",
  "That's a great photo — saved!",
  "Photo updated. Sharp look!",
  "Uploaded! That's a great shot.",
];

function pickCompliment() {
  return PHOTO_COMPLIMENTS[
    Math.floor(Math.random() * PHOTO_COMPLIMENTS.length)
  ];
}

const NAME_COMPLIMENTS = [
  "Name saved — nice to meet you!",
  "Updated! That's a great name.",
  "Saved. Good to have you, {name}.",
  "Name updated successfully!",
];

function pickNameCompliment(name) {
  const msg =
    NAME_COMPLIMENTS[Math.floor(Math.random() * NAME_COMPLIMENTS.length)];
  return msg.replace("{name}", name);
}

// ── App icon badge (unread chat count) ──
// We keep our own count as the source of truth rather than trusting the
// plugin's internal state (its own docs warn against mixing the two), and
// just call .set() to sync the display whenever it changes.
const UNREAD_COUNT_KEY = "dxpline-unread-count";

function getUnreadCount() {
  return +localStorage.getItem(UNREAD_COUNT_KEY) || 0;
}

function setUnreadCount(n) {
  const count = Math.max(0, n);
  localStorage.setItem(UNREAD_COUNT_KEY, String(count));
  if (
    window.cordova &&
    cordova.plugins &&
    cordova.plugins.notification &&
    cordova.plugins.notification.badge
  ) {
    cordova.plugins.notification.badge.set(count);
  }
}

function clearUnreadCount() {
  setUnreadCount(0);
}
