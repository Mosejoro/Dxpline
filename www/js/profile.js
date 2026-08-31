// ── Dxpline profile panel (index.html side) ──
// Compact view is read-only (avatar/name/streak at a glance). All editing —
// name, photo, reminder, font — lives in profile.html, loaded once expanded.

function renderCompactProfile() {
  const u = getCurrentUser();
  const p = loadProfile();
  document.getElementById("profileAvatar").src = p.photo;
  document.getElementById("ppAvatar").src = p.photo;
  document.getElementById("ppNameDisplay").textContent = p.name || "—";
  document.getElementById("ppEmailDisplay").textContent = u ? u.email : "";

  document.getElementById("ppCurrentStreak").textContent = currentStreak();

  const lvl = levelInfo();
  document.getElementById("ppLevelNum").textContent = lvl.level;
  document.getElementById("ppXpLbl").textContent = `${lvl.xp} XP`;
  const span = lvl.nextCeil - lvl.curFloor || 1;
  const pct = Math.min(100, Math.round(((lvl.xp - lvl.curFloor) / span) * 100));
  document.getElementById("ppXpFill").style.width = pct + "%";

  const best = longestStreak();
  document.getElementById("ppStreakNum").textContent = best.count;
  document.getElementById("ppStreakRange").textContent = best.count
    ? `${fmtDate(best.start)} — ${fmtDate(best.end)}`
    : "No streak recorded yet";
}

function openProfilePanel() {
  document.getElementById("profilePanel").classList.add("open");
  document.getElementById("ppOverlay").classList.add("show");
}

function closeProfilePanel() {
  const panel = document.getElementById("profilePanel");
  panel.classList.remove("open", "expanded");
  document.getElementById("ppOverlay").classList.remove("show");
  collapseToCompact(); // reset back to compact so re-opening doesn't start expanded
}

function toggleExpandPanel() {
  const panel = document.getElementById("profilePanel");
  if (panel.classList.contains("expanded")) {
    collapseToCompact();
  } else {
    expandToFullProfile();
  }
}

function expandToFullProfile() {
  const panel = document.getElementById("profilePanel");
  const loader = document.getElementById("ppLoader");
  const frame = document.getElementById("ppFrame");

  panel.classList.add("expanded");
  document.getElementById("ppCompact").style.display = "none";
  loader.classList.add("show");
  frame.classList.remove("show");

  const shownAt = Date.now();
  frame.onload = () => {
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, 450 - elapsed); // keep the splash visible briefly, avoids a flash
    setTimeout(() => {
      loader.classList.remove("show");
      frame.classList.add("show");
    }, remaining);
  };
  frame.src = "profile.html";
}

function collapseToCompact() {
  const panel = document.getElementById("profilePanel");
  panel.classList.remove("expanded");
  document.getElementById("ppCompact").style.display = "";
  document.getElementById("ppLoader").classList.remove("show");
  const frame = document.getElementById("ppFrame");
  frame.classList.remove("show");
  frame.src = "";
  renderCompactProfile(); // reflect anything changed inside the full page
}

onReady(() => {
  renderCompactProfile();
  document.getElementById("profileBtn").onclick = openProfilePanel;
  document.getElementById("ppClose").onclick = closeProfilePanel;
  document.getElementById("ppOverlay").onclick = closeProfilePanel;
  document.getElementById("ppExpand").onclick = toggleExpandPanel;
});