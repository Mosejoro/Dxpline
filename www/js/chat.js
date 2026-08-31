// ── Dxpline chat ──
// Direct messaging between accepted friends. Uses fsListenCollection (native:
// polling via fetchFirestoreCollection under the hood; web: real onSnapshot),
// same as friends.js — already fixed for the native plugin's quirks (filter
// format, object-vs-array shape) inside firestore-helpers.js, so nothing
// chat-specific needed to work around those here.

const toast = (msg) => {
  const e = document.getElementById("toast");
  e.textContent = msg;
  e.classList.add("show");
  setTimeout(() => e.classList.remove("show"), 2100);
};

function chatGetQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function chatEsc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : s;
  return d.innerHTML;
}

function chatFmtTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

let chatOtherUid = null;
let chatLastRenderedKey = "";

function chatSendMessage() {
  const me = getCurrentUser();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !me || !chatOtherUid) return;

  const id = me.uid + "_" + Date.now();
  fsSetDoc(
    "messages",
    id,
    {
      from: me.uid,
      to: chatOtherUid,
      users: [me.uid, chatOtherUid],
      text: text,
      createdAt: Date.now(),
    },
    (ok) => {
      if (ok) {
        input.value = "";
      } else {
        toast("Message failed to send");
      }
    },
  );
}

function chatRenderMessages(allMyMessages) {
  const me = getCurrentUser();
  if (!me || !chatOtherUid) return;
  localStorage.setItem(
    "dxpline-chat-lastread-" + chatOtherUid,
    String(Date.now()),
  );

  const relevant = allMyMessages
    .filter(
      (m) =>
        (m.from === me.uid && m.to === chatOtherUid) ||
        (m.from === chatOtherUid && m.to === me.uid),
    )
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const container = document.getElementById("chatMessages");

  if (!relevant.length) {
    container.innerHTML = `<div class="chat-empty">No messages yet — say hi!</div>`;
    chatLastRenderedKey = "";
    return;
  }

  // Skip re-rendering (and losing scroll position) if nothing actually changed.
  const key = relevant.map((m) => m.id).join(",");
  if (key === chatLastRenderedKey) return;
  chatLastRenderedKey = key;

  const wasNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  container.innerHTML = relevant
    .map(
      (m) => `
      <div class="msg ${m.from === me.uid ? "msg-mine" : "msg-theirs"}">
        ${chatEsc(m.text)}
        <span class="msg-time">${chatFmtTime(m.createdAt)}</span>
      </div>`,
    )
    .join("");

  if (wasNearBottom || relevant[relevant.length - 1].from === me.uid) {
    container.scrollTop = container.scrollHeight;
  }
}

function initChat() {
  clearUnreadCount(); // opening a chat means you've checked your messages

  const uid = chatGetQueryParam("uid");
  if (!uid) {
    document.getElementById("chatName").textContent = "No user specified";
    return;
  }
  chatOtherUid = uid;
  localStorage.setItem("dxpline-chat-lastread-" + uid, String(Date.now()));

  fsGetDoc("users_public", uid, (data) => {
    document.getElementById("chatAvatar").src =
      (data && data.photo) || "img/default.png";
    document.getElementById("chatName").textContent =
      (data && data.name) || "—";
  });

  onWebAuthReady(() => {
    const me = getCurrentUser();
    if (!me) return;
    fsListenCollection(
      "messages",
      [["users", "array-contains", me.uid]],
      chatRenderMessages,
    );
  });

  document.getElementById("chatSendBtn").onclick = chatSendMessage;
  document.getElementById("chatInput").onkeydown = (e) => {
    if (e.key === "Enter") chatSendMessage();
  };
}

// If deviceready already fired before this script ran, window.FirebasePlugin
// is already there — run immediately rather than waiting for an event that
// already happened (which would never fire again).
if (window.cordova && !window.FirebasePlugin) {
  document.addEventListener("deviceready", initChat);
} else {
  initChat();
}
