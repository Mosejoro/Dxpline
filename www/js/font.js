// ── Dxpline font preference ──
// Lets a user switch the whole app to a more readable font, saved per-account
// (reuses the same profile record as photo/name in profile-shared.js).
// Overrides the --head/--body/--mono variables the rest of the CSS already
// reads from — including the Driver.js walkthrough, which uses the same vars.

const FONT_OPTIONS = {
  default: { label: "Default (App)", family: null },
  inter: { label: "Inter", family: "'Inter', sans-serif" },
  atkinson: {
    label: "Atkinson Hyperlegible",
    family: "'Atkinson Hyperlegible', sans-serif",
  },
  opendyslexic: {
    label: "OpenDyslexic",
    family: "'OpenDyslexic', sans-serif",
  },
  georgia: { label: "Georgia (serif)", family: "Georgia, 'Times New Roman', serif" },
  poppins: { label: "Poppins", family: "'Poppins', sans-serif" },
  nunito: { label: "Nunito", family: "'Nunito', sans-serif" },
  merriweather: { label: "Merriweather (serif)", family: "'Merriweather', serif" },
  plexsans: { label: "IBM Plex Sans", family: "'IBM Plex Sans', sans-serif" },
  comicneue: { label: "Comic Neue", family: "'Comic Neue', cursive" },
};

function loadFontPreference() {
  const p = loadProfile(); // from profile-shared.js
  return p.font && FONT_OPTIONS[p.font] ? p.font : "default";
}

// Applies to THIS document's root only — index.html and profile.html each
// call this for themselves since they're separate documents (iframe).
//
// Only --body is swapped. --head (titles/wordmark) and --mono (tight numeric
// displays like streak counts and XP) stay on their original compact fonts —
// some options here (OpenDyslexic especially) render much larger at the same
// pixel size, and swapping those too broke the tightly-spaced UI.
function applyFont(key) {
  const opt = FONT_OPTIONS[key] || FONT_OPTIONS.default;
  const root = document.documentElement.style;
  if (opt.family) {
    root.setProperty("--body", opt.family);
  } else {
    root.removeProperty("--body");
  }
}

// Exposed so profile.html (running in the iframe) can persist the choice and
// push it into the parent document too, so both update live without a reload.
function setFontPreference(key) {
  saveProfile({ font: key }); // from profile-shared.js — localStorage is shared, so this covers both documents
  applyFont(key);
}

document.addEventListener("DOMContentLoaded", () => {
  applyFont(loadFontPreference());
});