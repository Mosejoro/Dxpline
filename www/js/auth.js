// ── Dxpline auth ──
// Two code paths:
//   NATIVE  (running in the built Cordova app, cordova-plugin-firebasex present)
//     → uses window.FirebasePlugin, which drives the real native Google Sign-In SDK
//   WEB     (testing in a plain browser, no plugin)
//     → falls back to the Firebase JS SDK's signInWithPopup
//
// Either path ends with the same result: a Firebase user, whose uid/displayName/email
// get saved to localStorage under "dxpline-user" for the rest of the app to read.

let isNative = false;

// TEMPORARY DEBUG AID — shows any uncaught error as an on-screen alert, since
// remote debugging isn't available right now. Remove once sign-in is confirmed working.
window.onerror = function (msg, url, line, col) {
  alert("DEBUG ERROR:\n" + msg + "\n" + (url || "") + ":" + line);
  return false;
};

document.addEventListener("deviceready", () => {
  isNative = !!window.FirebasePlugin;
  restoreNativeSession();
});

// If not in Cordova at all (plain browser), deviceready never fires — check on load too.
window.addEventListener("load", () => {
  if (!window.cordova) {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) saveSessionAndRedirect(user);
    });
  }
});

function restoreNativeSession() {
  if (!isNative) return;
  window.FirebasePlugin.getCurrentUser(
    (user) => saveSessionAndRedirect(user),
    () => {} // no user signed in yet — stay on login.html
  );
}

function saveSessionAndRedirect(user) {
  const profile = {
    uid: user.uid,
    name: user.displayName || user.name || "",
    email: user.email || "",
    createdAt:
      (user.metadata && user.metadata.creationTime) ||
      user.creationTimestamp ||
      null,
  };
  localStorage.setItem("dxpline-user", JSON.stringify(profile));
  if (location.pathname.endsWith("login.html")) {
    location.href = "index.html";
  }
}

function showError(msg) {
  const e = document.getElementById("authError");
  e.textContent = msg;
  e.style.display = "block";
}

// ── Email/Password ──

function signUpEmail() {
  const name = document.getElementById("suName").value.trim();
  const email = document.getElementById("suEmail").value.trim();
  const pass = document.getElementById("suPass").value;
  if (!name || !email || !pass) return showError("Fill in all fields.");

  if (isNative) {
    window.FirebasePlugin.createUserWithEmailAndPassword(
      email,
      pass,
      () => {
        window.FirebasePlugin.updateUserProfile(
          { displayName: name },
          () => restoreNativeSession(),
          (err) => showError(err)
        );
      },
      (err) => showError(err)
    );
  } else {
    firebase
      .auth()
      .createUserWithEmailAndPassword(email, pass)
      .then((cred) => cred.user.updateProfile({ displayName: name }))
      .then(() => firebase.auth().currentUser.reload())
      .then(() => saveSessionAndRedirect(firebase.auth().currentUser))
      .catch((err) => showError(err.message));
  }
}

function signInEmail() {
  try {
    const email = document.getElementById("siEmail").value.trim();
    const pass = document.getElementById("siPass").value;
    if (!email || !pass) return showError("Fill in all fields.");

    if (isNative) {
      window.FirebasePlugin.signInUserWithEmailAndPassword(
        email,
        pass,
        () => restoreNativeSession(),
        (err) => showError(err)
      );
    } else {
      firebase
        .auth()
        .signInWithEmailAndPassword(email, pass)
        .then((cred) => saveSessionAndRedirect(cred.user))
        .catch((err) => showError(err.message));
    }
  } catch (e) {
    alert("DEBUG signInEmail crashed: " + e.message);
  }
}

// ── Google ──

function signInGoogle() {
  try {
    if (isNative) {
      // Client ID = the "Web client" OAuth client ID from google-services.json / Firebase console
      // (Project settings → Service accounts, or inside google-services.json → oauth_client, type 3)
      window.FirebasePlugin.authenticateUserWithGoogle(
        "434263531950-kjje4sktda12mo5u1hpqbo2acohpfvnd.apps.googleusercontent.com",
        (credential) => {
          window.FirebasePlugin.signInWithCredential(
            credential,
            () => restoreNativeSession(),
            (err) => showError(err)
          );
        },
        (err) => showError(err)
      );
    } else {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase
        .auth()
        .signInWithPopup(provider)
        .then((cred) => saveSessionAndRedirect(cred.user))
        .catch((err) => showError(err.message));
    }
  } catch (e) {
    alert("DEBUG signInGoogle crashed: " + e.message);
  }
}

function signOutUser() {
  localStorage.removeItem("dxpline-user");
  if (isNative) {
    window.FirebasePlugin.signOutUser(
      () => (location.href = "login.html"),
      (err) => showError(err)
    );
  } else {
    firebase.auth().signOut().then(() => (location.href = "login.html"));
  }
}