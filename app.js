import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
GoogleAuthProvider,
signInWithPopup,
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
getFirestore,
doc,
setDoc,
collection,
addDoc,
getDocs,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* CONFIG */

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

/* 🔥 FORCE ACCOUNT PICKER */
provider.setCustomParameters({
prompt: "select_account"
});

let currentUser;

/* LOGIN */

window.googleLogin = async ()=>{
try{
await signInWithPopup(auth,provider);
}catch(e){
alert(e.message);
}
};

/* AUTH */

onAuthStateChanged(auth,user=>{
if(user){
currentUser=user;

/* SHOW EMAIL */
if(document.getElementById("userInfo")){
document.getElementById("userInfo").innerText =
"Logged in as: " + user.email;
}

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
currentUser=null;
showSection("login");
};

/* UI */

window.showSection = (id)=>{
document.querySelectorAll(".section").forEach(s=>s.style.display="none");
document.getElementById(id).style.display="block";
};

/* PROFILE + GROUP */

window.saveProfile = async ()=>{

const name=document.getElementById("name").value.trim();
const institution=document.getElementById("institution").value.trim();
const year=document.getElementById("year").value.trim();

if(!name || !institution || !year){
alert("Fill all fields");
return;
}

await setDoc(doc(db,"users",currentUser.uid),{
name,institution,year,email:currentUser.email
});

/* GROUP */

const groupName = institution.toLowerCase()+"-"+year;

let groupId=null;

const groups=await getDocs(collection(db,"groups"));

groups.forEach(d=>{
if(d.data().name===groupName){
groupId=d.id;
}
});

if(!groupId){
const g=await addDoc(collection(db,"groups"),{
name:groupName,
displayName: institution+" - "+year
});
groupId=g.id;
}

let exists=false;

const members=await getDocs(collection(db,"groupMembers"));

members.forEach(m=>{
let data=m.data();
if(data.userId===currentUser.uid && data.groupId===groupId){
exists=true;
}
});

if(!exists){
await addDoc(collection(db,"groupMembers"),{
groupId,
userId:currentUser.uid
});
}

alert("Profile Saved ✅");

};

/* FIND */

window.loadUsers = async ()=>{

const inst=document.getElementById("searchInstitution").value;
const year=document.getElementById("searchYear").value;

const snap=await getDocs(collection(db,"users"));

let html="";

snap.forEach(d=>{
let u=d.data();

if(
d.id!==currentUser.uid &&
u.institution &&
u.year &&
u.institution.toLowerCase()===inst.toLowerCase() &&
u.year===year
){
html+=`<div class="card">
${u.name}
<button onclick="addFriend('${d.id}')">Add Friend</button>
</div>`;
}
});

document.getElementById("findList").innerHTML=html;

};

/* FRIEND REQUEST */

window.addFriend = async(uid)=>{

await addDoc(collection(db,"friendRequests"),{
from:currentUser.uid,
to:uid,
status:"pending"
});

await addDoc(collection(db,"notifications"),{
userId:uid,
text: currentUser.displayName+" sent you request"
});

alert("Request Sent");

};

/* LOAD FRIENDS */

async function loadFriends(){

let html="";

const f=await getDocs(collection(db,"friends"));

f.forEach(d=>{
let data=d.data();

if(data.user1===currentUser.uid){
html+=`<div class="card">
Friend
<button onclick="openChat('${data.user2}')">Chat</button>
</div>`;
}

if(data.user2===currentUser.uid){
html+=`<div class="card">
Friend
<button onclick="openChat('${data.user1}')">Chat</button>
</div>`;
}

});

const r=await getDocs(collection(db,"friendRequests"));

r.forEach(d=>{
let data=d.data();

if(data.to===currentUser.uid && data.status==="pending"){
html+=`<div class="card">
Request
<button onclick="acceptRequest('${d.id}','${data.from}')">Accept</button>
<button onclick="rejectRequest('${d.id}')">Reject</button>
</div>`;
}
});

document.getElementById("friendsList").innerHTML=html;

}

/* ACCEPT */

window.acceptRequest = async(id,fromUid)=>{

await addDoc(collection(db,"friends"),{
user1:currentUser.uid,
user2:fromUid
});

await setDoc(doc(db,"friendRequests",id),{
status:"accepted"
});

await addDoc(collection(db,"notifications"),{
userId:fromUid,
text: currentUser.displayName+" accepted your request"
});

loadFriends();

};

/* REJECT */

window.rejectRequest = async(id)=>{
await setDoc(doc(db,"friendRequests",id),{
status:"rejected"
});
loadFriends();
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

let text=prompt("Message");

if(text){
addDoc(collection(db,"messages"),{
from:currentUser.uid,
to:uid,
text
});
}

};

/* GROUPS */

async function loadGroups(){

const m=await getDocs(collection(db,"groupMembers"));
const g=await getDocs(collection(db,"groups"));

let html="";

m.forEach(mem=>{
let data=mem.data();

if(data.userId===currentUser.uid){

g.forEach(gr=>{
if(gr.id===data.groupId){
html+=`<div class="card">
${gr.data().displayName || gr.data().name}
</div>`;
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
caption
});

document.getElementById("memoryCaption").value="";
};

function loadMemories(){

onSnapshot(collection(db,"memories"),async snap=>{

let html="";

for(const d of snap.docs){

let m=d.data();

let likes=await getDocs(collection(db,"memoryLikes"));
let count=0;

likes.forEach(l=>{
if(l.data().memoryId===d.id) count++;
});

html+=`<div class="card">
${m.caption}
<br>❤️ ${count}
<br><button onclick="likeMemory('${d.id}')">Like</button>
</div>`;
}

document.getElementById("memoriesList").innerHTML=html;

});

}

/* LIKE */

window.likeMemory = async(id)=>{
await addDoc(collection(db,"memoryLikes"),{
memoryId:id,
userId:currentUser.uid
});
};
