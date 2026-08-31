# Firebase Auth Setup — Dxpline

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com → **Add project** → name it (e.g. `dxpline`) → finish the wizard.
2. In the project, click **Build → Authentication → Get started**.
3. Under **Sign-in method**, enable:
   - **Email/Password**
   - **Google**
4. Go to **Project settings (gear icon) → General → Your apps → Add app → Web (`</>`)**.
   Register it (nickname: `dxpline-web`), skip hosting setup. Copy the `firebaseConfig` object it gives you — you'll paste it into `js/firebase-init.js` (marked with `TODO` below).

## 2. Android app registration (needed for the native Google Sign-In plugin)
1. Still in **Project settings → Your apps → Add app → Android**.
2. **Android package name** = whatever is in your Cordova `config.xml` as `id="..."` (e.g. `com.yourname.dxpline`).
3. **Debug signing certificate SHA-1** — get it by running:
   ```
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
   Paste the SHA-1 into Firebase (you can add more SHA-1s later for release builds).
4. Download `google-services.json` and put it at the **root of your Cordova project** (same level as `config.xml`). The plugin below auto-copies it into the Android platform on `cordova prepare`.

(iOS: add an iOS app too if/when you build for iOS, download `GoogleService-Info.plist`, same root placement.)

## 3. Install the Cordova plugin (native auth bridge)
From your Cordova project root:
```
cordova plugin add cordova-plugin-firebasex
```
This single plugin covers Email/Password + Google Sign-In natively, and reads `google-services.json` automatically.

Then add the Firebase JS SDK (compat build, no bundler needed) via CDN — already wired into `login.html` below.

## 4. Files added in this step
- `login.html` — sign in / sign up screen (Email + Google)
- `js/firebase-init.js` — **paste your `firebaseConfig` here**
- `js/auth.js` — sign-up/sign-in/sign-out logic, native + web fallback
- `js/auth-guard.js` — add this script to `index.html`; redirects to `login.html` if nobody's signed in, and stores the logged-in user's name/uid so the app can use it

## 5. What YOU need to do
- [ ] Create the Firebase project + enable Email/Password and Google providers (step 1)
- [ ] Register the Android app + drop `google-services.json` in project root (step 2)
- [ ] Run `cordova plugin add cordova-plugin-firebasex` (step 3)
- [ ] Paste your `firebaseConfig` into `js/firebase-init.js`
- [ ] Add `<script src="js/firebase-init.js"></script>` and `<script src="js/auth-guard.js"></script>` to the top of `index.html` (before `script.js`), and link `login.html`'s scripts the same way

Once that's in place, test in a regular browser first (Google button will use the popup fallback there), then build to a device to confirm native Google Sign-In works.

## 6. Daily reminder (item 3)
Run:
```
cordova plugin add cordova-plugin-local-notification
```
This is a community-maintained plugin (Katzer's original + forks) — check its GitHub for compatibility with whatever Android API level you're targeting before you build.

No config values needed — the reminder time is set per-account from inside the app (Profile → Daily Reminder), not hardcoded. In a plain browser this silently no-ops (logs a console warning) since there's no native notification system to hook into — it only actually fires once built to a device.

## 7. Cross-device sync (item 5, Firestore)
1. Firebase console → your `dxpline-app` project → **Build → Firestore Database → Create database**. Start in **production mode** (the rules below lock it down properly regardless).
2. Once created, go to the **Rules** tab and replace the default rules with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   This means each signed-in user can only ever read/write their own document — never anyone else's.
3. That's it — no other config. The app reads/writes a single document per account at `users/{uid}` holding tasks, history, XP, streak, profile, and reminder settings.