import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* 🔥 FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAK01_ZKFoPQQrpFqoRnlvuH0iVXLF7mqA",
  authDomain: "classmate-connect-4ef14.firebaseapp.com",
  projectId: "classmate-connect-4ef14",
  storageBucket: "classmate-connect-4ef14.appspot.com",
  messagingSenderId: "836999548178",
  appId: "1:836999548178:web:8fc82fcf07289647c5f7cb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser;

/* LOGIN */
window.googleLogin = () => {
  signInWithRedirect(auth, provider);
};

/* AUTH */
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    showSection("find");

    loadFriends();
    loadChats();
    loadNotifications();
    loadGroups();
  } else {
    showSection("login");
  }
});

/* LOGOUT */
window.logout = async () => {
  await signOut(auth);
  location.reload();
};

/* SECTION SWITCH */
window.showSection = (id) => {
  if (!currentUser && id !== "login") return;

  document.querySelectorAll(".section").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
};

/* PROFILE + AUTO GROUP */
window.saveProfile = async () => {
  const name = nameInput.value;
  const institution = institutionInput.value;
  const year = yearInput.value;
  const city = cityInput.value;

  await setDoc(doc(db, "users", currentUser.uid), {
    name, institution, year, city, email: currentUser.email
  });

  /* AUTO GROUP */
  const groupId = institution + "_" + year;
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);

  if (!groupSnap.exists()) {
    await setDoc(groupRef, {
      institution,
      year,
      created: Date.now()
    });
  }

  alert("Profile saved + Group created ✅");
};

/* FIND USERS */
window.loadUsers = async () => {
  const inst = searchInstitution.value;
  const year = searchYear.value;
  const city = searchCity.value;

  const snap = await getDocs(collection(db, "users"));

  let html = "";

  snap.forEach(d => {
    let u = d.data();

    if (
      d.id !== currentUser.uid &&
      u.institution === inst &&
      u.year === year &&
      u.city === city
    ) {
      html += `
      <div class="card">
        ${u.name}
        <button onclick="sendFriendRequest('${d.id}')">
        Send Friend Request
        </button>
      </div>`;
    }
  });

  findList.innerHTML = html;
};

/* SEND REQUEST */
window.sendFriendRequest = async (uid) => {

  await addDoc(collection(db, "friendRequests"), {
    from: currentUser.uid,
    to: uid,
    status: "pending",
    time: Date.now()
  });

  await addDoc(collection(db, "notifications"), {
    userId: uid,
    text: currentUser.displayName + " sent you a friend request",
    time: Date.now()
  });

  alert("Friend request sent ✅");
};

/* FRIEND REQUESTS */
function loadFriends() {

  onSnapshot(collection(db, "friendRequests"), snap => {

    let html = "";

    snap.forEach(docSnap => {
      let r = docSnap.data();

      if (r.to === currentUser.uid && r.status === "pending") {

        html += `
        <div class="card">
          Friend Request
          <button onclick="acceptRequest('${docSnap.id}','${r.from}')">Accept</button>
          <button onclick="rejectRequest('${docSnap.id}')">Reject</button>
        </div>`;
      }
    });

    friendsList.innerHTML = html;
  });
}

/* ACCEPT */
window.acceptRequest = async (id, fromUid) => {

  await addDoc(collection(db, "friends"), {
    user1: currentUser.uid,
    user2: fromUid
  });

  await updateDoc(doc(db, "friendRequests", id), {
    status: "accepted"
  });

  alert("Friend added ✅");
};

/* REJECT */
window.rejectRequest = async (id) => {
  await updateDoc(doc(db, "friendRequests", id), {
    status: "rejected"
  });
};

/* CHAT SEND */
window.sendMessage = async () => {
  const text = chatText.value;
  if (!text) return;

  await addDoc(collection(db, "messages"), {
    from: currentUser.uid,
    text,
    time: Date.now()
  });

  chatText.value = "";
};

/* LOAD CHAT */
function loadChats() {

  onSnapshot(collection(db, "messages"), snap => {

    let html = "";

    snap.forEach(d => {
      let m = d.data();
      let cls = m.from === currentUser.uid ? "me" : "other";

      html += `<div class="chat-bubble ${cls}">${m.text}</div>`;
    });

    chatList.innerHTML = html;
  });
}

/* GROUPS */
function loadGroups() {

  onSnapshot(collection(db, "groups"), snap => {

    let html = "";

    snap.forEach(d => {
      let g = d.data();

      if (
        g.institution === institutionInput.value &&
        g.year === yearInput.value
      ) {
        html += `
        <div class="card">
          Group: ${g.institution} (${g.year})
        </div>`;
      }
    });

    groupList.innerHTML = html;
  });
}

/* NOTIFICATIONS */
function loadNotifications() {

  onSnapshot(collection(db, "notifications"), snap => {

    let html = "";

    snap.forEach(d => {
      let n = d.data();

      if (n.userId === currentUser.uid) {
        html += `<div class="card">🔔 ${n.text}</div>`;
      }
    });

    notificationsList.innerHTML = html;
  });
}
