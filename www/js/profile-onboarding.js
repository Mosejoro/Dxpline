// ── Dxpline profile page walkthrough (Driver.js) ──
// Separate from the main app's tour (js/onboarding.js) — auto-runs once per
// account the first time the full profile view is opened, replayable anytime
// via the "?" button on this page. Tracked with its own seen-key so it's
// independent of the main tour's progress.
//
// Same lessons learned from the main tour's mobile bugs: target the larger
// wrapping card/section (not small inner elements), and wait two paint
// cycles + a longer delay on mobile before Driver.js takes its first
// measurement, since starting too early is what caused mismatched highlights
// there before.

const PROFILE_TOUR_CONTENT = [
  {
    title: "Your Profile",
    description:
      "A quick look at what's here — your stats, appearance settings, and reminder.",
  },
  {
    element: "#profHeadSection",
    title: "Photo & name",
    description:
      "Change your photo or update your name here — tap Save after editing your name.",
    side: "bottom",
  },
  {
    element: "#profStatsGrid",
    title: "Your stats",
    description:
      "Longest streak ever (with the dates it happened), your current streak, and when you joined.",
    side: "bottom",
  },
  {
    element: "#profLevelCard",
    title: "Discipline level",
    description: "Your level and XP progress toward the next one.",
    side: "top",
  },
  {
    element: "#profCatRows",
    title: "By category",
    description: "How many tasks you've completed in each category, all-time.",
    side: "top",
  },
  {
    element: "#profThemeCard",
    title: "Theme",
    description: "Switch the app's whole color scheme — synced across your devices.",
    side: "top",
  },
  {
    element: "#profFontCard",
    title: "Reading font",
    description:
      "Pick a font that's easier for you to read — a few are built specifically for readability.",
    side: "top",
  },
  {
    element: "#profReminderCard",
    title: "Daily reminder",
    description:
      "Turn on a daily nudge and set what time it shows up — it'll mention whatever task you're avoiding most.",
    side: "top",
  },
  {
    element: "#profSignOut",
    title: "Sign out",
    description: "Right here whenever you need it.",
    side: "top",
  },
];

function profileTourSeenKey(uid) {
  return `dxpline-profile-tour-seen-${uid}`;
}

function hasProfileTourSeen() {
  const u = getCurrentUser();
  if (!u) return true;
  return localStorage.getItem(profileTourSeenKey(u.uid)) === "1";
}

function markProfileTourSeen() {
  const u = getCurrentUser();
  if (!u) return;
  localStorage.setItem(profileTourSeenKey(u.uid), "1");
}

function buildProfileTourSteps() {
  return PROFILE_TOUR_CONTENT.map((item) => {
    const popover = { title: item.title, description: item.description };
    if (item.side) popover.side = item.side;
    return item.element ? { element: item.element, popover } : { popover };
  });
}

function startProfileTour() {
  if (!(window.driver && window.driver.js)) {
    console.warn("Driver.js not loaded — skipping walkthrough.");
    return;
  }

  const { driver } = window.driver.js;

  const tour = driver({
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    scrollIntoViewOptions: { behavior: "auto", block: "center" },
    onDestroyed: markProfileTourSeen,
    steps: buildProfileTourSteps(),
  });

  // Wait two full paint cycles before the first measurement — see note at
  // top of file. Fixes the mismatched-highlight bug the main tour hit.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      tour.drive();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("profHelpBtn").onclick = startProfileTour;

  if (!hasProfileTourSeen()) {
    const delay = window.innerWidth <= 900 ? 1500 : 600;
    setTimeout(startProfileTour, delay);
  }
});