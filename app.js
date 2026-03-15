import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, query, getDocs, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser;
let chatUser;
let currentGroup = null;
let usersMap = {};

window.googleLogin = () => signInWithRedirect(auth, provider);

onAuthStateChanged(auth, user => {

if (user) {

currentUser = user;

document.getElementById("login").style.display = "none";

loadUsersMap();
loadFriends();
loadChats();
loadGroups();

showSection("chats");

} else {

showSection("login");

}

});

window.logout = async () => {

await signOut(auth);
location.reload();

};

async function loadUsersMap() {

const snapshot = await getDocs(collection(db, "users"));

snapshot.forEach(docu => {

usersMap[docu.id] = docu.data().name;

});

}

window.saveProfile = async () => {

try {

const name = document.getElementById("name").value;
const nickname = document.getElementById("nickname").value;
const institution = document.getElementById("institution").value;
const course = document.getElementById("course").value;
const year = document.getElementById("year").value;
const city = document.getElementById("city").value;

if (!name || !institution || !course || !year)
return alert("Fill all required fields");

await setDoc(doc(db, "users", currentUser.uid), {
name,
nickname,
institution,
course,
year,
city
});

const groupId = `${institution}_${course}_${year}`;

await setDoc(doc(db, "groups", groupId), {
institution,
course,
year
}, { merge: true });

await setDoc(doc(db, "groupMembers", `${currentUser.uid}_${groupId}`), {
groupId,
userId: currentUser.uid
});

alert("Profile saved & joined your batch group");

loadGroups();

showSection("chats");

} catch (err) {

console.error(err);

}

};

window.findClassmates = async () => {

const inst = document.getElementById("searchInstitution").value.toLowerCase();
const year = document.getElementById("searchYear").value;

const snapshot = await getDocs(collection(db, "users"));

let html = "";

snapshot.forEach(docu => {

let d = docu.data();

if (
d.institution &&
d.institution.toLowerCase().includes(inst) &&
d.year &&
d.year.includes(year) &&
docu.id !== currentUser.uid
) {

html += `<div class="card" onclick="openChat('${docu.id}','${d.name}')">${d.name} (${d.nickname})</div>`;

}

});

document.getElementById("results").innerHTML = html;

};

function loadFriends() {

const q = query(collection(db, "users"));

onSnapshot(q, snapshot => {

let html = "";

snapshot.forEach(docu => {

let d = docu.data();

if (docu.id !== currentUser.uid) {

html += `<div class="card" onclick="openChat('${docu.id}','${d.name}')">${d.name}</div>`;

}

});

document.getElementById("friendsList").innerHTML = html;

});

}

function loadChats() {

const q = query(collection(db, "messages"));

onSnapshot(q, snapshot => {

let chats = {};

snapshot.forEach(docu => {

let m = docu.data();

if (m.from === currentUser.uid || m.to === currentUser.uid) {

let friend = m.from === currentUser.uid ? m.to : m.from;

chats[friend] = m.text || "📷 Image";

}

});

let html = "";

for (let id in chats) {

const name = usersMap[id] || "User";

html += `<div class="card" onclick="openChat('${id}','${name}')">${name}: ${chats[id]}</div>`;

}

document.getElementById("chatList").innerHTML = html;

});

}

window.openChat = (uid, name) => {

currentGroup = null;

chatUser = uid;

document.getElementById("chatName").innerText = name;

showSection("chatScreen");

loadMessages();

};

window.openGroupChat = (groupId, name) => {

chatUser = null;

currentGroup = groupId;

document.getElementById("chatName").innerText = name;

showSection("chatScreen");

loadGroupMessages();

};

window.sendMsg = async () => {

let text = document.getElementById("msgInput").value;

if (text === "") return;

if (currentGroup) {

await addDoc(collection(db, "groupMessages"), {
groupId: currentGroup,
senderId: currentUser.uid,
senderName: usersMap[currentUser.uid] || "User",
text: text,
time: Date.now()
});

} else {

await addDoc(collection(db, "messages"), {
from: currentUser.uid,
to: chatUser,
text: text,
image: "",
time: Date.now()
});

}

document.getElementById("msgInput").value = "";

};

function loadMessages() {

const q = query(collection(db, "messages"));

onSnapshot(q, snapshot => {

let html = "";

snapshot.forEach(docu => {

let m = docu.data();

if (
(m.from === currentUser.uid && m.to === chatUser) ||
(m.from === chatUser && m.to === currentUser.uid)
) {

let cls = m.from === currentUser.uid ? "msg me" : "msg other";

html += `<div class="${cls}">${m.text}</div>`;

}

});

document.getElementById("chatBox").innerHTML = html;

});

}

function loadGroupMessages() {

const q = query(collection(db, "groupMessages"));

onSnapshot(q, snapshot => {

let html = "";

snapshot.forEach(docu => {

let m = docu.data();

if (m.groupId === currentGroup) {

let cls = m.senderId === currentUser.uid ? "msg me" : "msg other";

html += `<div class="${cls}">
<b>${m.senderName}</b><br>
${m.text}
</div>`;

}

});

document.getElementById("chatBox").innerHTML = html;

});

}

async function loadGroups() {

const groupsSnapshot = await getDocs(collection(db, "groups"));

let html = "";

for (const groupDoc of groupsSnapshot.docs) {

const g = groupDoc.data();
const groupId = groupDoc.id;

const memberDoc = await getDoc(
doc(db, "groupMembers", `${currentUser.uid}_${groupId}`)
);

if (memberDoc.exists()) {

html += `<div class="card" onclick="openGroupChat('${groupId}','${g.institution} - ${g.course} - ${g.year}')">${g.institution} - ${g.course} - ${g.year}</div>`;

}

}

document.getElementById("groupList").innerHTML = html;

}

window.showSection = id => {

document.querySelectorAll(".section").forEach(s => s.style.display = "none");

document.getElementById(id).style.display = "block";

};
