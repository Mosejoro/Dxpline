// ── Dxpline back-button handling ──
// Without this, Android's back gesture/button just exits the app the moment
// there's no page history left — which is almost always, since this app
// doesn't navigate between real pages. Instead: if the profile panel is open,
// back closes it; otherwise it takes two presses within ~2s to actually exit,
// so an accidental swipe doesn't lose your place.

let backPressedOnce = false;

function onHardwareBack(e) {
  e.preventDefault();

  const panel = document.getElementById("profilePanel");
  if (panel && panel.classList.contains("open")) {
    if (typeof closeProfilePanel === "function") closeProfilePanel();
    return;
  }

  if (backPressedOnce) {
    navigator.app.exitApp();
    return;
  }
  backPressedOnce = true;
  if (typeof toast === "function") toast("Press back again to exit");
  setTimeout(() => {
    backPressedOnce = false;
  }, 2000);
}

document.addEventListener("deviceready", () => {
  document.addEventListener("backbutton", onHardwareBack, false);
});