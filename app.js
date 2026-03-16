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

/* AUTH STATE */

onAuthStateChanged(auth,user=>{

if(user){

currentUser=user;

showSection("find");

loadUsers();
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

window.logout = async () => {

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

name:name,
nickname:nickname,
institution:institution,
course:course,
year:year,
city:city,
email:currentUser.email

});

alert("Profile Saved");

};

/* FIND BATCHMATES */

async function loadUsers(){

const q=query(collection(db,"users"));

const snapshot=await getDocs(q);

let html="";

snapshot.forEach(d=>{

let u=d.data();

if(d.id!==currentUser.uid){

let name=u.name || "User";

html+=`<div class="card">

${name}

<button onclick="addFriend('${d.id}','${name}')">Add Friend</button>

</div>`;

}

});

document.getElementById("findList").innerHTML=html;

}

/* ADD FRIEND */

window.addFriend = async(uid,name)=>{

await addDoc(collection(db,"friends"),{

user1:currentUser.uid,
user2:uid,
time:Date.now()

});

alert("Friend Added");

loadFriends();

};

/* LOAD FRIENDS */

async function loadFriends(){

const q=query(collection(db,"friends"));

const snapshot=await getDocs(q);

let html="";

snapshot.forEach(d=>{

let f=d.data();

if(f.user1===currentUser.uid){

html+=`<div class="card">

Friend

<button onclick="openChat('${f.user2}')">Chat</button>

</div>`;

}

});

document.getElementById("friendsList").innerHTML=html;

}

/* CHATS */

function loadChats(){

const q=query(collection(db,"messages"));

onSnapshot(q,snapshot=>{

let html="";

snapshot.forEach(d=>{

let m=d.data();

if(m.to===currentUser.uid){

html+=`<div class="card">${m.text}</div>`;

}

});

document.getElementById("chatList").innerHTML=html;

});

}

/* OPEN CHAT */

window.openChat=(uid)=>{

let text=prompt("Send message");

if(text){

addDoc(collection(db,"messages"),{

from:currentUser.uid,
to:uid,
text:text,
time:Date.now()

});

}

};

/* GROUPS */

async function loadGroups(){

const q=query(collection(db,"groups"));

const snapshot=await getDocs(q);

let html="";

snapshot.forEach(d=>{

let g=d.data();

html+=`<div class="card">${g.name}</div>`;

});

document.getElementById("groupList").innerHTML=html;

}

/* MEMORIES */

window.uploadMemory = async ()=>{

let caption=document.getElementById("memoryCaption").value;

if(caption==="") return;

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

<button onclick="likeMemory('${d.id}')">Like</button>

</div>`;

});

document.getElementById("memoriesList").innerHTML=html;

});

}

/* LIKE MEMORY */

window.likeMemory = async(memoryId)=>{

await addDoc(collection(db,"memoryLikes"),{

memoryId:memoryId,
userId:currentUser.uid

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
