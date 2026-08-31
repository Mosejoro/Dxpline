// ── Generic Firestore helpers (native + web) ──
// Used by the friends system (js/friends.js) for anything beyond the single
// "users" document cloud-sync.js already handles (which has its own similar
// but separate helpers — left untouched here to avoid risking that working
// sync code while building this on top of it).
//
// Native path uses cordova-plugin-firebasex's methods (same authenticated
// session as native sign-in — see the note in cloud-sync.js for why the web
// SDK can't be used for this in the built app). Web path is for browser
// testing only.

function fsNativeAvailable() {
  return !!(window.cordova && window.FirebasePlugin);
}

function fsGetDoc(collection, docId, onDone) {
  if (fsNativeAvailable()) {
    window.FirebasePlugin.fetchDocumentInFirestoreCollection(
      docId,
      collection,
      (doc) => onDone(doc && doc.exists !== false ? doc.data || doc : null),
      (err) => {
        console.error("fsGetDoc failed:", err);
        onDone(null);
      }
    );
  } else if (window.firebase) {
    firebase
      .firestore()
      .collection(collection)
      .doc(docId)
      .get({ source: "server" }) // bypass local cache — always fetch the real current state
      .then((snap) => onDone(snap.exists ? snap.data() : null))
      .catch((err) => {
        console.error("fsGetDoc failed:", err);
        onDone(null);
      });
  } else {
    onDone(null);
  }
}

function fsSetDoc(collection, docId, data, onDone) {
  if (fsNativeAvailable()) {
    window.FirebasePlugin.setDocumentInFirestoreCollection(
      docId,
      data,
      collection,
      () => onDone && onDone(true),
      (err) => {
        console.error("fsSetDoc failed:", err);
        onDone && onDone(false);
      }
    );
  } else if (window.firebase) {
    firebase
      .firestore()
      .collection(collection)
      .doc(docId)
      .set(data, { merge: true })
      .then(() => onDone && onDone(true))
      .catch((err) => {
        console.error("fsSetDoc failed:", err);
        onDone && onDone(false);
      });
  } else {
    onDone && onDone(false);
  }
}

function fsDeleteDoc(collection, docId, onDone) {
  if (fsNativeAvailable()) {
    window.FirebasePlugin.deleteDocumentFromFirestoreCollection(
      docId,
      collection,
      () => onDone && onDone(true),
      (err) => {
        console.error("fsDeleteDoc failed:", err);
        onDone && onDone(false);
      }
    );
  } else if (window.firebase) {
    firebase
      .firestore()
      .collection(collection)
      .doc(docId)
      .delete()
      .then(() => onDone && onDone(true))
      .catch((err) => {
        console.error("fsDeleteDoc failed:", err);
        onDone && onDone(false);
      });
  } else {
    onDone && onDone(false);
  }
}

// filters: array of [field, operator, value] — e.g. [["to", "==", uid], ["status", "==", "pending"]]
function fsQueryCollection(collection, filters, onDone) {
  if (fsNativeAvailable()) {
    // The native plugin expects each filter as ['where', field, operator, value],
    // not the simpler [field, operator, value] this helper's callers use —
    // translate here so nothing else needs to know about that quirk.
    const nativeFilters = filters.map(([field, op, value]) => [
      "where",
      field,
      op,
      value,
    ]);
    window.FirebasePlugin.fetchFirestoreCollection(
      collection,
      nativeFilters,
      (docs) => {
        // Native returns an object keyed by document ID, not an array like
        // the web SDK — normalize to the same {id, ...data} array shape
        // every caller already expects.
        const arr = docs
          ? Object.keys(docs).map((id) => ({ id, ...docs[id] }))
          : [];
        onDone(arr);
      },
      (err) => {
        console.error("fsQueryCollection failed:", err);
        onDone([]);
      }
    );
  } else if (window.firebase) {
    let ref = firebase.firestore().collection(collection);
    filters.forEach(([field, op, value]) => {
      ref = ref.where(field, op, value);
    });
    ref
      .get({ source: "server" }) // bypass local cache — always fetch the real current state
      .then((snap) => onDone(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => {
        console.error("fsQueryCollection failed:", err);
        onDone([]);
      });
  } else {
    onDone([]);
  }
}

// Real-time listeners — the native plugin's own live-update mechanism
// (same idea as the web SDK's onSnapshot), avoiding any caching staleness
// that plain one-off fetches were hitting, and updating automatically
// without polling.
function fsListenDoc(collection, docId, onUpdate) {
  if (fsNativeAvailable()) {
    // The native plugin's listenTo* methods throw an internal error on this
    // build ("error is not a function" inside the plugin's own bridge code) —
    // rather than keep guessing at its exact expected call shape, poll the
    // confirmed-working one-off fetch method instead. Less elegant than a
    // real listener, but reliable.
    const poll = () => fsGetDoc(collection, docId, onUpdate);
    poll();
    setInterval(poll, 4000);
  } else if (window.firebase) {
    firebase
      .firestore()
      .collection(collection)
      .doc(docId)
      .onSnapshot(
        (snap) => onUpdate(snap.exists ? snap.data() : null),
        (err) => console.error("fsListenDoc failed:", err)
      );
  }
}

function fsListenCollection(collection, filters, onUpdate) {
  if (fsNativeAvailable()) {
    // Same reasoning as fsListenDoc — poll the confirmed-working fetch
    // method instead of the native listenTo* method, which throws an
    // internal plugin error on this build.
    const poll = () => fsQueryCollection(collection, filters, onUpdate);
    poll();
    setInterval(poll, 4000);
  } else if (window.firebase) {
    let ref = firebase.firestore().collection(collection);
    filters.forEach(([field, op, value]) => {
      ref = ref.where(field, op, value);
    });
    ref.onSnapshot(
      (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("fsListenCollection failed:", err)
    );
  }
}

function pairId(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

// Firebase's web SDK doesn't populate firebase.auth().currentUser synchronously
// right after sign-in or on a fresh page load — it takes a moment to confirm
// the session. Firestore calls fired before that confirmation completes get
// silently treated as unauthenticated ("Missing or insufficient permissions"),
// even though the user really is signed in. Wait for the real signal instead
// of assuming it's ready. Native doesn't have this problem (different auth
// mechanism entirely), so this only matters for the web SDK path.
function onWebAuthReady(cb) {
  if (fsNativeAvailable() || !window.firebase) return cb();
  const unsub = firebase.auth().onAuthStateChanged((user) => {
    unsub();
    if (!user) {
      console.warn(
        "Firebase web auth session is empty after confirmation — Firestore calls will fail. Check that sign-in actually completed in this browser session."
      );
    }
    cb();
  });
}

// Keeps users_public/{uid} in sync with your current name/photo/email so
// you're findable in the directory. Called from profile-shared.js's
// saveProfile() and once on every app load from cloud-sync.js. Needs
// loadProfile()/getCurrentUser() from profile-shared.js — this file must
// load after that one.
function pushPublicProfile() {
  const u = getCurrentUser();
  if (!u) return;
  const p = loadProfile();
  fsSetDoc("users_public", u.uid, {
    name: p.name || u.name || "",
    photo: p.photo || "img/default.png",
    email: u.email || "",
  });
}