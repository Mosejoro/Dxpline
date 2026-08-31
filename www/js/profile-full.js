// ── Dxpline full profile page (profile.html) ──
// Loaded inside an iframe in the panel on index.html, OR can be opened directly
// (falls back gracefully to standalone navigation when there's no parent app).

const toast = (msg) => {
  const e = document.getElementById("toast");
  e.textContent = msg;
  e.classList.add("show");
  setTimeout(() => e.classList.remove("show"), 2100);
};

const inIframe = window.parent && window.parent !== window;

function doSignOut() {
  if (inIframe && typeof window.parent.signOutUser === "function") {
    window.parent.signOutUser();
  } else {
    localStorage.removeItem("dxpline-user");
    location.href = "login.html";
  }
}

function renderFullProfile() {
  const u = getCurrentUser();
  const p = loadProfile();

  document.getElementById("profAvatar").src = p.photo;
  document.getElementById("profName").value = p.name;
  document.getElementById("profEmail").textContent = u ? u.email : "";
  document.getElementById("profJoined").textContent =
    u && u.createdAt ? fmtDate(u.createdAt) : "—";

  const best = longestStreak();
  document.getElementById("profLongestNum").textContent = best.count;
  document.getElementById("profLongestRange").textContent = best.count
    ? `${fmtDate(best.start)} — ${fmtDate(best.end)}`
    : "No streak recorded yet";

  document.getElementById("profCurrentNum").textContent = currentStreak();

  const lvl = levelInfo();
  document.getElementById("profLevelLbl").textContent = `Lv ${lvl.level}`;
  document.getElementById("profXpLbl").textContent = `${lvl.xp} XP`;
  const span = lvl.nextCeil - lvl.curFloor || 1;
  const pct = Math.min(100, Math.round(((lvl.xp - lvl.curFloor) / span) * 100));
  document.getElementById("profXpFill").style.width = pct + "%";

  const cats = categoryTotals();
  const CN = {
    quick: "Easy Mode",
    moderate: "Moderately Hard",
    deep: "Deep Workings",
    resist: "Hard Tasks",
  };
  const rows = document.getElementById("profCatRows");
  rows.innerHTML = Object.keys(CN)
    .map(
      (c) =>
        `<div class="prof-catrow"><span>${CN[c]}</span><span>${cats[c] || 0}</span></div>`,
    )
    .join("");
}

function saveFullProfileName() {
  const name = document.getElementById("profName").value.trim();
  if (!name) return;
  saveProfile({ name });

  const u = getCurrentUser();
  if (u) {
    u.name = name;
    localStorage.setItem("dxpline-user", JSON.stringify(u));
  }
  if (
    inIframe &&
    typeof window.parent.isNative !== "undefined" &&
    window.parent.isNative &&
    window.parent.FirebasePlugin
  ) {
    window.parent.FirebasePlugin.updateUserProfile(
      { displayName: name },
      () => {},
      () => {},
    );
  } else if (
    window.parent &&
    window.parent.firebase &&
    window.parent.firebase.auth().currentUser
  ) {
    window.parent.firebase
      .auth()
      .currentUser.updateProfile({ displayName: name });
  }
  toast(pickNameCompliment(name));
}

function handleFullPhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  uploadToCloudinary(
    file,
    (url) => {
      saveProfile({ photo: url });
      document.getElementById("profAvatar").src = url;
      toast(pickCompliment());
    },
    (err) => toast("Upload failed: " + err),
  );
}

function renderReminderSettings() {
  if (!inIframe || typeof window.parent.getReminderSettings !== "function") {
    document.getElementById("remEnabled").disabled = true;
    document.getElementById("remTime").disabled = true;
    document.getElementById("remSave").disabled = true;
    return;
  }
  const s = window.parent.getReminderSettings();
  document.getElementById("remEnabled").checked = !!s.enabled;
  document.getElementById("remTime").value = s.time || "20:00";
}

function saveReminder() {
  if (!inIframe || typeof window.parent.saveReminderSettings !== "function") {
    toast("Reminders only work inside the app, not standalone.");
    return;
  }
  const enabled = document.getElementById("remEnabled").checked;
  const time = document.getElementById("remTime").value || "20:00";
  window.parent.saveReminderSettings(enabled, time);
  toast(enabled ? "Reminder saved" : "Reminder turned off");
}

function renderThemeSelect() {
  const select = document.getElementById("themeSelect");
  select.innerHTML = Object.entries(THEME_OPTIONS)
    .map(([key, opt]) => `<option value="${key}">${opt.label}</option>`)
    .join("");
  select.value = loadThemePreference();
  select.onchange = () => {
    const key = select.value;
    setThemePreference(key); // applies to profile.html itself + persists
    if (inIframe && typeof window.parent.applyTheme === "function") {
      window.parent.applyTheme(key); // sync index.html live too, no reload needed
    }
  };
}

function renderFontSelect() {
  const select = document.getElementById("fontSelect");
  select.innerHTML = Object.entries(FONT_OPTIONS)
    .map(([key, opt]) => `<option value="${key}">${opt.label}</option>`)
    .join("");
  select.value = loadFontPreference();
  select.onchange = () => {
    const key = select.value;
    setFontPreference(key); // applies to profile.html itself + persists
    if (inIframe && typeof window.parent.applyFont === "function") {
      window.parent.applyFont(key); // sync index.html live too, no reload needed
    }
  };
}

function safeRun(fn, label) {
  try {
    fn();
  } catch (e) {
    console.error(`profile.html: ${label} failed:`, e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  safeRun(renderFullProfile, "renderFullProfile");
  safeRun(renderReminderSettings, "renderReminderSettings");
  safeRun(renderThemeSelect, "renderThemeSelect");
  safeRun(renderFontSelect, "renderFontSelect");
  document.getElementById("profSignOut").onclick = doSignOut;
  document.getElementById("profSaveName").onclick = saveFullProfileName;
  document.getElementById("profPhotoInput").onchange = handleFullPhotoUpload;
  document.getElementById("remSave").onclick = saveReminder;
});
