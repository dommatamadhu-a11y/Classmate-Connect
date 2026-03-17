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

onAuthStateChanged(auth,user=>{

if(user){

currentUser=user;

showSection("find");

loadFriends();
loadChats();
loadGroups();
loadMemories();
loadNotifications();

}else{

showSection("login");

}

});

/* LOGOUT */

window.logout = async ()=>{
await signOut(auth);
location.reload();
};

/* UI */

window.showSection = (id)=>{

document.querySelectorAll(".section").forEach(s=>{
s.style.display="none";
});

document.getElementById(id).style.display="block";

};

/* PROFILE + AUTO GROUP */

window.saveProfile = async ()=>{

const name=document.getElementById("name").value;
const nickname=document.getElementById("nickname").value;
const institution=document.getElementById("institution").value;
const course=document.getElementById("course").value;
const year=document.getElementById("year").value;
const city=document.getElementById("city").value;

/* SAVE USER */

await setDoc(doc(db,"users",currentUser.uid),{
name,
nickname,
institution,
course,
year,
city,
email:currentUser.email
});

/* GROUP NAME */

const groupName = institution + " - " + year;

/* CHECK GROUP */

const gSnap = await getDocs(collection(db,"groups"));

let groupId = null;

gSnap.forEach(d=>{
if(d.data().name === groupName){
groupId = d.id;
}
});

/* CREATE IF NOT EXISTS */

if(!groupId){

const newGroup = await addDoc(collection(db,"groups"),{
name:groupName,
time:Date.now()
});

groupId = newGroup.id;

}

/* ADD MEMBER */

await addDoc(collection(db,"groupMembers"),{
groupId,
userId:currentUser.uid
});

alert("Profile Saved & Group Joined");

};

/* FIND BATCHMATES */

window.loadUsers = async ()=>{

const institution=document.getElementById("searchInstitution").value;
const year=document.getElementById("searchYear").value;

const snap = await getDocs(collection(db,"users"));

let html="";

snap.forEach(d=>{

let u=d.data();

if(
d.id!==currentUser.uid &&
u.institution &&
u.year &&
u.institution.toLowerCase()===institution.toLowerCase() &&
u.year===year
){

html+=`
<div class="card">
${u.name} (${u.nickname || ""})
<button onclick="addFriend('${d.id}')">Add Friend</button>
</div>
`;

}

});

document.getElementById("findList").innerHTML=html;

};

/* FRIENDS */

window.addFriend = async(uid)=>{

await addDoc(collection(db,"friends"),{
user1:currentUser.uid,
user2:uid,
time:Date.now()
});

alert("Friend Added");
loadFriends();

};

async function loadFriends(){

const snap = await getDocs(collection(db,"friends"));

let html="";

snap.forEach(d=>{

let f=d.data();

if(f.user1===currentUser.uid){

html+=`
<div class="card">
Friend
<button onclick="openChat('${f.user2}')">Chat</button>
</div>
`;

}

});

document.getElementById("friendsList").innerHTML=html;

}

/* CHAT */

function loadChats(){

onSnapshot(collection(db,"messages"),snap=>{

let html="";

snap.forEach(d=>{

let m=d.data();

if(m.to===currentUser.uid){

html+=`<div class="card">${m.text}</div>`;

}

});

document.getElementById("chatList").innerHTML=html;

});

}

window.openChat = (uid)=>{

let text = prompt("Send message");

if(text){

addDoc(collection(db,"messages"),{
from:currentUser.uid,
to:uid,
text,
time:Date.now()
});

}

};

/* GROUPS */

async function loadGroups(){

const members = await getDocs(collection(db,"groupMembers"));
const groups = await getDocs(collection(db,"groups"));

let html="";

members.forEach(m=>{

let mem=m.data();

if(mem.userId===currentUser.uid){

groups.forEach(g=>{

if(g.id===mem.groupId){

html+=`<div class="card">${g.data().name}</div>`;

}

});

}

});

document.getElementById("groupList").innerHTML=html;

}

/* MEMORIES */

window.uploadMemory = async ()=>{

let caption=document.getElementById("memoryCaption").value;

if(!caption) return;

await addDoc(collection(db,"memories"),{
userId:currentUser.uid,
caption,
time:Date.now()
});

document.getElementById("memoryCaption").value="";

};

function loadMemories(){

onSnapshot(collection(db,"memories"),snap=>{

let html="";

snap.forEach(d=>{

let m=d.data();

html+=`
<div class="card">
${m.caption}
<button onclick="likeMemory('${d.id}')">Like</button>
</div>
`;

});

document.getElementById("memoriesList").innerHTML=html;

});

}

window.likeMemory = async(id)=>{

await addDoc(collection(db,"memoryLikes"),{
memoryId:id,
userId:currentUser.uid
});

};

/* NOTIFICATIONS */

function loadNotifications(){

onSnapshot(collection(db,"notifications"),snap=>{

let html="";

snap.forEach(d=>{

let n=d.data();

if(n.userId===currentUser.uid){

html+=`<div class="card">${n.text}</div>`;

}

});

document.getElementById("notificationsList").innerHTML=html;

});

}
