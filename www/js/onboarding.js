// ── Dxpline onboarding walkthrough (Driver.js) ──
// Auto-runs once per account on first login, and can be replayed anytime via
// the "?" button in the topbar.
//
// Element highlighting kept for all devices. Mobile highlights were landing
// on the wrong element because Driver.js was measuring positions before the
// mobile layout had fully settled (address bar collapsing, fonts swapping
// in). Fix: wait two paint cycles before Driver.js's first measurement, and
// give mobile a longer pre-tour delay.

const TOUR_CONTENT = [
  {
    title: "Welcome to Dxpline",
    description:
      "A quick tour of how tasks, streaks, and discipline scoring work here.",
  },
  {
    element: "#Task",
    title: "Add all task needed",
    description: "Type a task here, then press Enter or hit Add Task.",
    side: "left",
  },
  {
    element: "#Cat",
    title: "Pick a category",
    description:
      "Easy Mode, Moderately Hard, Deep Workings, or Hard Tasks — this decides which column it lands in and how much it counts toward your discipline score.",
    side: "right",
  },
  {
    element: ".xpblk",
    title: "Discipline level",
    description:
      "Your level and XP, based on what you complete. Harder categories earn more.",
    side: "right",
  },
  {
    element: ".strow",
    title: "Your streak",
    description:
      "Consecutive days you've shown up. Keep it going — it resets if a day passes with nothing done.",
    side: "right",
  },
  {
    element: "#board",
    title: "Your board",
    description:
      "Tasks are grouped by category. Drag a task between columns if you want to reclassify it.",
    side: "top",
  },
  {
    element: "#right",
    title: "Progress panel",
    description:
      "Today's completion, your hard-tasks meter, category breakdown, and weekly heatmap — all live here.",
    side: "left",
  },
  {
    element: "#refl",
    title: "Weekly reflection",
    description:
      "A short read on how your week's gone — what's slipping, what's sticking.",
    side: "left",
  },
  {
    element: ".dpill",
    title: "Discipline score",
    description:
      "A running score based on what you complete and how consistently you show up.",
    side: "bottom",
  },
  {
    element: ".profile-floating",
    title: "Your profile",
    description:
      "Change your photo/name, see your longest streak, and set a daily reminder from here.",
    side: "left",
  },
];

function tourSeenKey(uid) {
  return `dxpline-tour-seen-${uid}`;
}

function hasTourSeen() {
  const u = getCurrentUser();
  if (!u) return true; // don't show if we don't know who's logged in
  return localStorage.getItem(tourSeenKey(u.uid)) === "1";
}

function markTourSeen() {
  const u = getCurrentUser();
  if (!u) return;
  localStorage.setItem(tourSeenKey(u.uid), "1");
}

function buildTourSteps() {
  return TOUR_CONTENT.map((item) => {
    const popover = { title: item.title, description: item.description };
    if (item.side) popover.side = item.side;
    return item.element ? { element: item.element, popover } : { popover };
  });
}

function startOnboardingTour() {
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
    scrollIntoViewOptions: false,
    onHighlightStarted: (element) => {
      // Driver.js's own scroll-into-view doesn't reliably handle nested
      // scrollable containers (the left sidebar and right panel each scroll
      // independently here). The browser's native scrollIntoView does
      // handle nested containers correctly, so do it ourselves, instantly,
      // before Driver.js measures the target's position.
      if (element && element.scrollIntoView) {
        element.scrollIntoView({ behavior: "auto", block: "center" });
      }
    },
    onDestroyed: markTourSeen,
    steps: buildTourSteps(),
  });

  // Wait for two full paint cycles before Driver.js takes its first
  // measurement — on mobile, the viewport/layout can still be settling
  // (address bar collapsing, fonts swapping in) right when the tour starts,
  // and Driver.js measuring too early is what was causing highlights to
  // land on the wrong element throughout the tour.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      tour.drive();
    });
  });
}

onReady(() => {
  document.getElementById("helpBtn").onclick = startOnboardingTour;

  // Auto-start for first-time users. Mobile gets a longer delay — its layout
  // (address bar collapsing, fonts swapping in) takes longer to fully settle
  // than desktop, and starting too early was the root cause of mismatched
  // highlights throughout the tour.
  if (!hasTourSeen()) {
    const delay = window.innerWidth <= 900 ? 1500 : 600;
    setTimeout(startOnboardingTour, delay);
  }
});