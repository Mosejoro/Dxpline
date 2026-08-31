// ── Dxpline daily reminder ──
// Lives on index.html (where the Cordova local-notifications plugin actually runs).
// profile.html's settings UI calls these via window.parent since it's an iframe on the same origin.
//
// Needs: cordova plugin add cordova-plugin-local-notification
// In a plain browser (no plugin), scheduling is skipped with a console warning — expected until
// this is tested inside the built app.

const REMINDER_ID = 9001;

// keep in sync with script.js's CN map
const REMINDER_CN = {
  quick: "Easy Mode",
  moderate: "Moderately Hard",
  deep: "Deep Workings",
  resist: "Hard Tasks",
};

function reminderKey(uid) {
  return `dxpline-reminder-${uid}`;
}

function loadReminderSettings() {
  const u = getCurrentUser();
  if (!u) return { enabled: false, time: "20:00" };
  const raw = localStorage.getItem(reminderKey(u.uid));
  return raw ? JSON.parse(raw) : { enabled: false, time: "20:00" };
}

// Exposed for profile.html (running in the iframe) to read current settings.
function getReminderSettings() {
  return loadReminderSettings();
}

// Exposed for profile.html to save + (re)schedule from its Save button.
function saveReminderSettings(enabled, time) {
  const u = getCurrentUser();
  if (!u) return;
  localStorage.setItem(reminderKey(u.uid), JSON.stringify({ enabled, time }));
  if (window.pushCloudSync) window.pushCloudSync();
  if (enabled) {
    scheduleReminder(time);
  } else {
    cancelReminder();
  }
}

// Picks the task to nudge about: hardest pending category first, since those
// are the ones most likely to get avoided.
function pickNudgeTask() {
  const tasks = JSON.parse(localStorage.getItem("fw3-t") || "[]");
  const pending = tasks.filter((t) => !t.done);
  if (!pending.length) return null;

  const priority = ["resist", "deep", "moderate", "quick"];
  for (const cat of priority) {
    const hit = pending.find((t) => t.cat === cat);
    if (hit) return { title: hit.title, catLabel: REMINDER_CN[cat] };
  }
  return { title: pending[0].title, catLabel: REMINDER_CN[pending[0].cat] };
}

function buildNotificationText() {
  const nudge = pickNudgeTask();
  if (!nudge) {
    return "No pending tasks right now — add one to keep your streak alive.";
  }
  return `Still waiting: "${nudge.title}" (${nudge.catLabel})`;
}

function scheduleReminder(time) {
  if (!(window.cordova && cordova.plugins && cordova.plugins.notification)) {
    console.warn(
      "Local notification plugin not available (expected in a plain browser) — reminder not scheduled."
    );
    return;
  }
  const [hour, minute] = time.split(":").map(Number);
  const local = cordova.plugins.notification.local;

  local.requestPermission((granted) => {
    if (!granted) return;
    local.cancel(REMINDER_ID, () => {
      local.schedule({
        id: REMINDER_ID,
        title: "Dxpline",
        text: buildNotificationText(),
        trigger: { every: { hour, minute } },
      });
    });
  });
}

function cancelReminder() {
  if (!(window.cordova && cordova.plugins && cordova.plugins.notification)) return;
  cordova.plugins.notification.local.cancel(REMINDER_ID);
}

// Called whenever task data changes (see the hook added to script.js's save()),
// so the notification text stays reasonably current next time it fires.
function refreshReminder() {
  const s = loadReminderSettings();
  if (s.enabled) scheduleReminder(s.time);
}

document.addEventListener("deviceready", () => {
  const s = loadReminderSettings();
  if (s.enabled) scheduleReminder(s.time);
});