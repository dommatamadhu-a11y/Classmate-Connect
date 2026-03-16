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

/* FIREBASE CONFIG */

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

let currentUser = null;
let currentChatUser = null;
let currentGroup = null;

/* LOGIN */

window.googleLogin = () => {

signInWithRedirect(auth, provider);

};

/* AUTH STATE */

onAuthStateChanged(auth,(user)=>{

if(user){

currentUser = user;

showSection("chats");

loadUsers();
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

/* SHOW SECTION */

window.showSection = (id)=>{

document.querySelectorAll(".section").forEach(sec=>{
sec.style.display="none";
});

let el=document.getElementById(id);

if(el){
el.style.display="block";
}

};

/* SAVE PROFILE */

window.saveProfile = async ()=>{

const name=document.getElementById("name").value;
const nickname=document.getElementById("nickname").value;
const institution=document.getElementById("institution").value;
const course=document.getElementById("course").value;
const year=document.getElementById("year").value;
const city=document.getElementById("city").value;

await setDoc(doc(db,"users",currentUser.uid),{

name,
nickname,
institution,
course,
year,
city,
email:currentUser.email

});

alert("Profile Saved");

};

/* LOAD USERS (FIND BATCHMATES) */

async function loadUsers(){

const q=query(collection(db,"users"));

const snapshot=await getDocs(q);

let html="";

snapshot.forEach(d=>{

let u=d.data();

if(d.id!==currentUser.uid){

html+=`<div class="card">

${u.name} (${u.nickname || ""})

<button onclick="openChat('${d.id}','${u.name}')">Chat</button>

</div>`;

}

});

document.getElementById("chatList").innerHTML=html;

}

/* OPEN CHAT */

window.openChat=(uid,name)=>{

currentChatUser=uid;

document.getElementById("chatName").innerText=name;

showSection("chatScreen");

loadMessages();

};

/* LOAD MESSAGES */

function loadMessages(){

const q=query(collection(db,"messages"));

onSnapshot(q,snapshot=>{

let html="";

snapshot.forEach(d=>{

let m=d.data();

if(

(m.from===currentUser.uid && m.to===currentChatUser) ||

(m.from===currentChatUser && m.to===currentUser.uid)

){

let cls=m.from===currentUser.uid?"me":"other";

html+=`<div class="msg ${cls}">${m.text}</div>`;

}

});

document.getElementById("chatBox").innerHTML=html;

});

}

/* SEND MESSAGE */

window.sendMsg=async()=>{

let text=document.getElementById("msgInput").value;

if(text==="") return;

await addDoc(collection(db,"messages"),{

from:currentUser.uid,
to:currentChatUser,
text:text,
time:Date.now()

});

document.getElementById("msgInput").value="";

};

/* GROUPS */

async function loadGroups(){

const q=query(collection(db,"groups"));

const snapshot=await getDocs(q);

let html="";

snapshot.forEach(d=>{

let g=d.data();

html+=`<div class="card">

${g.name}

<button onclick="openGroup('${d.id}','${g.name}')">Open</button>

</div>`;

});

document.getElementById("groupList").innerHTML=html;

}

/* OPEN GROUP */

window.openGroup=(gid,name)=>{

currentGroup=gid;

document.getElementById("chatName").innerText=name;

showSection("chatScreen");

loadGroupMessages();

};

/* GROUP MESSAGES */

function loadGroupMessages(){

const q=query(collection(db,"groupMessages"));

onSnapshot(q,snapshot=>{

let html="";

snapshot.forEach(d=>{

let m=d.data();

if(m.groupId===currentGroup){

html+=`<div class="msg">${m.text}</div>`;

}

});

document.getElementById("chatBox").innerHTML=html;

});

}

/* MEMORIES */

window.uploadMemory=async()=>{

let caption=document.getElementById("memoryCaption").value;

await addDoc(collection(db,"memories"),{

userId:currentUser.uid,
caption:caption,
time:Date.now()

});

document.getElementById("memoryCaption").value="";

};

/* LOAD MEMORIES */

function loadMemories(){

const q=query(collection(db,"memories"));

onSnapshot(q,snapshot=>{

let html="";

snapshot.forEach(d=>{

let m=d.data();

html+=`<div class="card">

${m.caption}

<button onclick="likeMemory('${d.id}','${m.userId}')">Like</button>

</div>`;

});

document.getElementById("memoriesList").innerHTML=html;

});

}

/* LIKE MEMORY */

window.likeMemory=async(memoryId,ownerId)=>{

await addDoc(collection(db,"memoryLikes"),{

memoryId:memoryId,
userId:currentUser.uid

});

};

/* COMMENT MEMORY */

window.commentMemory=async(memoryId)=>{

let comment=document.getElementById("commentInput").value;

if(comment==="") return;

await addDoc(collection(db,"memoryComments"),{

memoryId:memoryId,
userName:currentUser.displayName,
comment:comment,
time:Date.now()

});

};

/* NOTIFICATIONS */

function loadNotifications(){

const q=query(collection(db,"notifications"));

onSnapshot(q,snapshot=>{

let html="";

snapshot.forEach(d=>{

let n=d.data();

if(n.userId===currentUser.uid){

html+=`<div class="card">${n.text}</div>`;

}

});

document.getElementById("notificationsList").innerHTML=html;

});

}
