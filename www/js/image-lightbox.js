// ── Full-size image viewer ──
// Tap any friend's photo (in the directory, a friend's board, or chat) to see
// it full-size in an overlay; tap the overlay to dismiss. Used across
// users.html, friend-board.html, chat.html.

function ensureLightboxEl() {
  let el = document.getElementById("imgLightbox");
  if (!el) {
    el = document.createElement("div");
    el.id = "imgLightbox";
    el.className = "img-lightbox-overlay";
    el.innerHTML = '<img id="imgLightboxImg" src="" alt="" />';
    el.onclick = () => el.classList.remove("show");
    document.body.appendChild(el);
  }
  return el;
}

function showImageLightbox(src) {
  if (!src) return;
  const el = ensureLightboxEl();
  document.getElementById("imgLightboxImg").src = src;
  el.classList.add("show");
}
