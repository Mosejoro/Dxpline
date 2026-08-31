// Include this on index.html, before script.js.
// Blocks the app from rendering if nobody's signed in.

(function () {
  const raw = localStorage.getItem("dxpline-user");
  if (!raw) {
    location.href = "login.html";
    return;
  }
  window.dxplineUser = JSON.parse(raw);
})();
