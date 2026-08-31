// ── Dxpline cloud sync (Firestore) ──
// Firestore is the source of truth for tasks/history/xp/streak/profile/reminder,
// keeping the same account in sync across devices. localStorage stays as the
// fast local cache script.js/profile.js/etc already read and write directly —
// this file's job is to pull the latest cloud state into localStorage BEFORE
// those scripts load, and push local changes back up whenever they save.
//
// IMPORTANT: native sign-in (cordova-plugin-firebasex) and the JS Firebase SDK
// (firebase.firestore()) have COMPLETELY SEPARATE authenticated sessions — the
// JS SDK has no idea a native sign-in happened. Using firebase.firestore() in
// the built app meant every read/write was silently unauthenticated and
// rejected by Firestore's security rules, which is why nothing was actually
// syncing despite Firestore being "wired in". Fix: use the native plugin's own
// Firestore methods (same session as native auth) when running in the built
// app, and only fall back to the JS SDK for plain-browser testing.

// script.js/profile.js/onboarding.js register their own startup this way instead
// of a raw DOMContentLoaded listener, since by the time they're injected below,
// DOMContentLoaded has already fired once and won't fire again.
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

function nativeFirestoreAvailable() {
  return !!(window.cordova && window.FirebasePlugin);
}

function collectLocalState(uid) {
  return {
    tasks: JSON.parse(localStorage.getItem("fw3-t") || "[]"),
    hist: JSON.parse(localStorage.getItem("fw3-h") || "{}"),
    totalXP: +localStorage.getItem("fw3-xp") || 0,
    streak: +localStorage.getItem("fw3-s") || 0,
    profile: JSON.parse(localStorage.getItem(profileKey(uid)) || "{}"),
    reminder: JSON.parse(localStorage.getItem(reminderKey(uid)) || "{}"),
    updatedAt: Date.now(),
  };
}

function applyCloudState(uid, data) {
  if (!data) return;
  localStorage.setItem("fw3-t", JSON.stringify(data.tasks || []));
  localStorage.setItem("fw3-h", JSON.stringify(data.hist || {}));
  localStorage.setItem("fw3-xp", String(data.totalXP || 0));
  localStorage.setItem("fw3-s", String(data.streak || 0));
  if (data.profile) {
    localStorage.setItem(profileKey(uid), JSON.stringify(data.profile));
  }
  if (data.reminder) {
    localStorage.setItem(reminderKey(uid), JSON.stringify(data.reminder));
  }
}

// ── Native path (cordova-plugin-firebasex) ──
function nativeFetchUserDoc(uid, onDone) {
  window.FirebasePlugin.fetchDocumentInFirestoreCollection(
    uid,
    "users",
    (doc) => {
      // Plugin versions differ slightly in shape here — handle a few.
      if (!doc) return onDone(null);
      if (doc.exists === false) return onDone(null);
      onDone(doc.data || doc);
    },
    (err) => {
      console.error("Native Firestore fetch failed:", err);
      onDone(null);
    },
  );
}

function nativeSetUserDoc(uid, data, onDone) {
  window.FirebasePlugin.setDocumentInFirestoreCollection(
    uid,
    data,
    "users",
    () => onDone && onDone(true),
    (err) => {
      console.error("Native Firestore push failed:", err);
      onDone && onDone(false);
    },
  );
}

// ── Web SDK path (plain browser testing only) ──
function webFirestoreDocRef(uid) {
  return firebase.firestore().collection("users").doc(uid);
}

let pushTimer = null;
// Exposed globally — script.js's save(), profile-shared.js's saveProfile(), and
// reminder.js's saveReminderSettings() each call this after writing locally.
function pushCloudSync() {
  const u = getCurrentUser();
  if (!u) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const data = collectLocalState(u.uid);
    if (nativeFirestoreAvailable()) {
      nativeSetUserDoc(u.uid, data);
    } else if (window.firebase) {
      webFirestoreDocRef(u.uid)
        .set(data, { merge: true })
        .catch((err) => console.error("Cloud sync push failed:", err));
    }
  }, 800); // debounced so rapid task edits don't spam Firestore writes
}

function loadAppScripts() {
  const scripts = ["js/profile.js", "js/script.js", "js/onboarding.js"];
  let loaded = 0;
  scripts.forEach((src) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false; // dynamically-inserted scripts run out of order by default — force sequence
    s.onload = s.onerror = () => {
      loaded++;
      if (loaded === scripts.length) {
        const overlay = document.getElementById("appLoading");
        if (overlay) overlay.style.display = "none";
      }
    };
    document.body.appendChild(s);
  });
}

function initCloudSync() {
  const u = getCurrentUser();
  if (!u) {
    loadAppScripts();
    return;
  }

  const proceed = () => {
    if (typeof pushPublicProfile === "function") pushPublicProfile();

    if (nativeFirestoreAvailable()) {
      nativeFetchUserDoc(u.uid, (data) => {
        if (data) {
          applyCloudState(u.uid, data);
        } else {
          pushCloudSync(); // first sync for this account — seed the cloud doc
        }
        loadAppScripts();
      });
    } else if (window.firebase) {
      webFirestoreDocRef(u.uid)
        .get({ source: "server" })
        .then((doc) => {
          if (doc.exists) {
            applyCloudState(u.uid, doc.data());
          } else {
            pushCloudSync();
          }
        })
        .catch((err) => console.error("Cloud sync fetch failed:", err))
        .finally(loadAppScripts);
    } else {
      loadAppScripts();
    }
  };

  if (typeof onWebAuthReady === "function") {
    onWebAuthReady(proceed);
  } else {
    proceed();
  }
}

// Native plugins (window.FirebasePlugin) aren't guaranteed available until
// deviceready fires, so gate initialization behind that in a Cordova context.
if (window.cordova) {
  document.addEventListener("deviceready", initCloudSync);
} else {
  onReady(initCloudSync);
}
