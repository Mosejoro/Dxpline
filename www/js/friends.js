// ── Dxpline friends system ──
// Public directory (users_public/{uid}: name/photo/email only) + friend
// requests (friendRequests/{pairId}: sorted-uid-pair doc, status pending →
// accepted). One query for the whole directory, one query for everything
// relevant to the current user's relationships, then rendered as two lists:
// Friends (accepted) and All Users (everyone else, with the right action per
// person: Add / Pending / Accept+Decline).

const toast = (msg) => {
  const e = document.getElementById("toast");
  e.textContent = msg;
  e.classList.add("show");
  setTimeout(() => e.classList.remove("show"), 2100);
};

let directoryCache = {}; // uid -> {name, photo, email}
let relationCache = {}; // otherUid -> {status, requestId, from}
let unreadCache = {}; // otherUid -> unread count from that friend

let directoryReady = false;
let relationsReady = false;

function startFriendsListeners(onUpdate) {
  const me = getCurrentUser();
  if (!me) return;

  fsListenCollection("users_public", [], (docs) => {
    directoryCache = {};
    docs.forEach((d) => {
      directoryCache[d.id] = { name: d.name, photo: d.photo, email: d.email };
    });
    directoryReady = true;
    onUpdate(); // render with whatever we have — don't wait on the other fetch
  });

  fsListenCollection(
    "friendRequests",
    [["users", "array-contains", me.uid]],
    (docs) => {
      relationCache = {};
      docs.forEach((d) => {
        const otherUid = d.users.find((u) => u !== me.uid);
        if (otherUid) {
          relationCache[otherUid] = {
            status: d.status,
            requestId: d.id,
            from: d.from,
          };
        }
      });
      relationsReady = true;
      onUpdate(); // render with whatever we have — don't wait on the other fetch
    },
  );

  fsListenCollection(
    "messages",
    [["users", "array-contains", me.uid]],
    (docs) => {
      unreadCache = {};
      docs.forEach((m) => {
        if (m.to !== me.uid) return; // only counting messages sent TO me
        const lastRead =
          +localStorage.getItem("dxpline-chat-lastread-" + m.from) || 0;
        if ((m.createdAt || 0) > lastRead) {
          unreadCache[m.from] = (unreadCache[m.from] || 0) + 1;
        }
      });
      onUpdate();
    },
  );
}

function sendFriendRequest(otherUid) {
  const me = getCurrentUser();
  if (!me) return;
  const id = pairId(me.uid, otherUid);
  fsSetDoc(
    "friendRequests",
    id,
    {
      from: me.uid,
      to: otherUid,
      users: [me.uid, otherUid],
      status: "pending",
    },
    (ok) => {
      if (ok) {
        toast("Request sent"); // listener will pick up the change automatically
      } else {
        toast("Couldn't send request");
      }
    },
  );
}

function acceptRequest(otherUid) {
  const me = getCurrentUser();
  const rel = relationCache[otherUid];
  if (!me || !rel) return;
  fsSetDoc(
    "friendRequests",
    rel.requestId,
    {
      from: rel.from,
      to: me.uid,
      users: [me.uid, otherUid],
      status: "accepted",
    },
    (ok) => {
      if (ok) {
        toast("You're now connected"); // listener will pick up the change automatically
      } else {
        toast("Couldn't accept request");
      }
    },
  );
}

function removeRelation(otherUid, silent) {
  const rel = relationCache[otherUid];
  if (!rel) return;
  fsDeleteDoc("friendRequests", rel.requestId, (ok) => {
    if (ok) {
      if (!silent) toast("Removed"); // listener will pick up the change automatically
    } else {
      toast("Couldn't remove");
    }
  });
}

function renderFriendsPage() {
  const me = getCurrentUser();
  if (!me) return;

  const friendsList = document.getElementById("friendsList");
  const usersList = document.getElementById("usersList");
  const searchTerm = (document.getElementById("userSearch").value || "")
    .trim()
    .toLowerCase();

  const entries = Object.entries(directoryCache).filter(
    ([uid]) => uid !== me.uid,
  );

  const friends = entries.filter(
    ([uid]) => relationCache[uid] && relationCache[uid].status === "accepted",
  );
  const others = entries.filter(
    ([uid]) =>
      !(relationCache[uid] && relationCache[uid].status === "accepted") &&
      (!searchTerm ||
        (directoryCache[uid].email || "").toLowerCase().includes(searchTerm) ||
        (directoryCache[uid].name || "").toLowerCase().includes(searchTerm)),
  );

  friendsList.innerHTML = friends.length
    ? friends
        .map(([uid, d]) => {
          const unread = unreadCache[uid] || 0;
          return `
      <div class="user-row${unread ? " user-row-unread" : ""}">
        <img src="${d.photo || "img/default.png"}" class="user-row-avatar" onclick="showImageLightbox(this.src); event.stopPropagation();" />
        <div class="user-row-info">
          <div class="user-row-name">${d.name || "—"}</div>
          <div class="user-row-email">${d.email || ""}</div>
        </div>
        <div class="user-row-actions">
          <button class="user-row-btn user-row-btn-chat" onclick="location.href='chat.html?uid=${uid}'">
            💬${unread ? `<span class="user-row-badge">${unread > 9 ? "9+" : unread}</span>` : ""}
          </button>
          <button class="user-row-btn" onclick="location.href='friend-board.html?uid=${uid}'">View</button>
          <button class="user-row-btn user-row-btn-ghost" onclick="removeRelation('${uid}')">Remove</button>
        </div>
      </div>`;
        })
        .join("")
    : `<div class="users-empty">No friends yet — add someone below.</div>`;

  usersList.innerHTML = others.length
    ? others
        .map(([uid, d]) => {
          const rel = relationCache[uid];
          let action;
          if (!rel) {
            action = `<button class="user-row-btn" onclick="sendFriendRequest('${uid}')">Add</button>`;
          } else if (rel.status === "pending" && rel.from === me.uid) {
            action = `<button class="user-row-btn user-row-btn-ghost" onclick="removeRelation('${uid}')">Cancel</button>`;
          } else if (rel.status === "pending" && rel.from !== me.uid) {
            action = `
              <button class="user-row-btn" onclick="acceptRequest('${uid}')">Accept</button>
              <button class="user-row-btn user-row-btn-ghost" onclick="removeRelation('${uid}')">Decline</button>`;
          } else {
            action = "";
          }
          return `
      <div class="user-row">
        <img src="${d.photo || "img/default.png"}" class="user-row-avatar" onclick="showImageLightbox(this.src); event.stopPropagation();" />
        <div class="user-row-info">
          <div class="user-row-name">${d.name || "—"}</div>
          <div class="user-row-email">${d.email || ""}</div>
        </div>
        <div class="user-row-actions">${action}</div>
      </div>`;
        })
        .join("")
    : `<div class="users-empty">No users found.</div>`;
}

function initFriendsPage() {
  onWebAuthReady(() => {
    pushPublicProfile();
    startFriendsListeners(renderFriendsPage);
  });
  document.getElementById("userSearch").oninput = renderFriendsPage;
}

// If deviceready already fired before this script ran, window.FirebasePlugin
// is already there — run immediately rather than waiting for an event that
// already happened (which would never fire again).
if (window.cordova && !window.FirebasePlugin) {
  document.addEventListener("deviceready", initFriendsPage);
} else {
  initFriendsPage();
}
