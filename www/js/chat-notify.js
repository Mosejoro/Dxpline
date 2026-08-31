// ── Dxpline chat notifications ──
// Global watcher (loaded on index.html, not chat.html) that polls for new
// incoming messages from ANY friend and fires a local notification, so you
// get notified even while looking at your board or another chat, not just
// while sitting in the specific conversation. Paired with
// cordova-plugin-background-mode so this keeps polling while you're briefly
// in other apps too — see SETUP.md section 10 for the honest limits of that.

const CHAT_NOTIFY_SEEN_KEY = "dxpline-chat-notified-ids";
let chatNotifyNextId = 9500; // separate ID range from the daily reminder (9001)

function getNotifiedMessageIds() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(CHAT_NOTIFY_SEEN_KEY) || "[]"),
    );
  } catch (e) {
    return new Set();
  }
}

function saveNotifiedMessageIds(idSet) {
  // Keep this bounded — only the most recent 200 IDs, oldest dropped first.
  const arr = Array.from(idSet).slice(-200);
  localStorage.setItem(CHAT_NOTIFY_SEEN_KEY, JSON.stringify(arr));
}

function fireChatNotification(senderName, text) {
  if (!(window.cordova && cordova.plugins && cordova.plugins.notification))
    return;
  const local = cordova.plugins.notification.local;
  local.requestPermission((granted) => {
    if (!granted) return;
    local.schedule({
      id: chatNotifyNextId++,
      title: senderName || "New message",
      text: text,
    });
  });
}

function pollForNewMessages() {
  const me = getCurrentUser();
  if (!me) return;

  fsQueryCollection(
    "messages",
    [["users", "array-contains", me.uid]],
    (docs) => {
      const seen = getNotifiedMessageIds();
      const primedKey = "dxpline-chat-notify-primed-" + me.uid;
      if (!localStorage.getItem(primedKey)) {
        // First run — mark everything that already exists as seen, so we
        // only notify about messages that arrive from here on.
        docs.forEach((m) => seen.add(m.id));
        saveNotifiedMessageIds(seen);
        localStorage.setItem(primedKey, "1");
        return;
      }

      const incoming = docs.filter((m) => m.from !== me.uid && !seen.has(m.id));
      if (!incoming.length) return;

      incoming.forEach((m) => seen.add(m.id));
      setUnreadCount(getUnreadCount() + incoming.length);
      saveNotifiedMessageIds(seen);

      // Group by sender so a burst of messages from one friend doesn't spam
      // separate notifications — one per sender per poll cycle.
      const bySender = {};
      incoming.forEach((m) => {
        if (!bySender[m.from]) bySender[m.from] = [];
        bySender[m.from].push(m);
      });

      Object.keys(bySender).forEach((senderUid) => {
        const msgs = bySender[senderUid];
        const preview =
          msgs.length === 1 ? msgs[0].text : `${msgs.length} new messages`;
        fsGetDoc("users_public", senderUid, (data) => {
          fireChatNotification((data && data.name) || "New message", preview);
        });
      });
    },
  );
}

function enableBackgroundMode() {
  if (!(window.cordova && cordova.plugins && cordova.plugins.backgroundMode))
    return;
  cordova.plugins.backgroundMode.setDefaults({
    title: "Dxpline",
    text: "Keeping you connected",
  });
  cordova.plugins.backgroundMode.enable();
}

function startChatNotifyWatcher() {
  enableBackgroundMode();
  pollForNewMessages();
  setInterval(pollForNewMessages, 6000);
}

// If deviceready already fired before this script ran, the plugins are
// already there — run immediately rather than waiting for an event that
// already happened (which would never fire again).
if (window.cordova && !window.FirebasePlugin) {
  document.addEventListener("deviceready", startChatNotifyWatcher);
} else {
  startChatNotifyWatcher();
}
