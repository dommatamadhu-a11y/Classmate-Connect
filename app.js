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
query,
getDocs,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

onAuthStateChanged(auth, async user => {

if(user){
currentUser = user;

showSection("find");

loadUsers();
loadFriends();
loadChats();
loadNotifications();

}else{
showSection("login");
}

});

/* LOGOUT */

window.logout = async () => {
await signOut(auth);
location.reload();
};

/* SECTION */

window.showSection = (id)=>{

if(!currentUser && id !== "login") return;

document.querySelectorAll(".section").forEach(s=>{
s.style.display="none";
});

document.getElementById(id).style.display="block";

};

/* PROFILE SAVE */

window.saveProfile = async ()=>{

const name = document.getElementById("name").value;
const institution = document.getElementById("institution").value;
const year = document.getElementById("year").value;

await setDoc(doc(db,"users",currentUser.uid),{
name,
institution,
year,
email:currentUser.email
});

alert("Profile saved");

createAutoGroup(institution,year);

};

/* AUTO GROUP */

async function createAutoGroup(institution,year){

const groupId = institution + "_" + year;

await setDoc(doc(db,"groups",groupId),{
institution,
year,
created:Date.now()
});

}

/* FIND USERS */

window.loadUsers = async ()=>{

const inst = document.getElementById("searchInstitution").value;
const year = document.getElementById("searchYear").value;

const snapshot = await getDocs(collection(db,"users"));

let html="";

snapshot.forEach(d=>{

let u = d.data();

if(d.id !== currentUser.uid){

if(
(!inst || u.institution === inst) &&
(!year || u.year === year)
){

html+=`
<div class="card">
${u.name || "User"}
<button onclick="addFriend('${d.id}','${u.name}')">Add Friend</button>
</div>
`;

}

}

});

document.getElementById("findList").innerHTML = html;

};

/* ADD FRIEND + NOTIFICATION */

window.addFriend = async (uid,name)=>{

await addDoc(collection(db,"friends"),{
from:currentUser.uid,
to:uid,
time:Date.now()
});

/* CREATE NOTIFICATION */

await addDoc(collection(db,"notifications"),{
userId:uid,
text: currentUser.displayName + " sent you a friend request",
time:Date.now(),
read:false
});

alert("Friend request sent");

};

/* LOAD FRIENDS */

async function loadFriends(){

const snapshot = await getDocs(collection(db,"friends"));

let html="";

snapshot.forEach(d=>{

let f = d.data();

if(f.from === currentUser.uid){

html+=`
<div class="card">
Friend
</div>
`;

}

});

document.getElementById("friendsList").innerHTML = html;

}

/* CHAT SEND */

window.sendMessage = async ()=>{

const text = document.getElementById("chatText").value;

if(!text) return;

await addDoc(collection(db,"messages"),{
from:currentUser.uid,
text,
time:Date.now()
});

document.getElementById("chatText").value="";

};

/* LOAD CHATS */

function loadChats(){

const q = query(collection(db,"messages"));

onSnapshot(q,snap=>{

let html="";

snap.forEach(d=>{

let m = d.data();

let cls = m.from === currentUser.uid ? "me" : "other";

html+=`
<div class="chat-bubble ${cls}">
${m.text}
</div>
`;

});

document.getElementById("chatList").innerHTML = html;

});

}

/* MEMORIES */

window.uploadMemory = async ()=>{

const caption = document.getElementById("memoryCaption").value;

if(!caption) return;

await addDoc(collection(db,"memories"),{
userId:currentUser.uid,
caption,
time:Date.now()
});

document.getElementById("memoryCaption").value="";

};

/* NOTIFICATIONS */

function loadNotifications(){

const q = query(collection(db,"notifications"));

onSnapshot(q,snapshot=>{

let html="";

snapshot.forEach(d=>{

let n = d.data();

if(n.userId === currentUser.uid){

html+=`
<div class="card">
${n.text}
</div>
`;

}

});

document.getElementById("notificationsList").innerHTML = html;

});

}
