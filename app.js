import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
GoogleAuthProvider,
signInWithRedirect,
onAuthStateChanged,
signOut,
getRedirectResult
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

/* SCREEN FIX */
document.addEventListener("visibilitychange", () => {
if (document.visibilityState === "visible") {
location.reload();
}
});

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

let currentUser;

/* 🔥 REDIRECT FIX */
getRedirectResult(auth).catch(e=>console.log(e));

/* LOGIN */

window.googleLogin = ()=>{
signInWithRedirect(auth,provider);
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
document.querySelectorAll(".section").forEach(s=>s.style.display="none");
document.getElementById(id).style.display="block";
};

/* PROFILE + GROUP FIX */

window.saveProfile = async ()=>{

try{

const name=document.getElementById("name").value.trim();
const institution=document.getElementById("institution").value.trim();
const year=document.getElementById("year").value.trim();

if(!name || !institution || !year){
alert("Fill all required fields");
return;
}

await setDoc(doc(db,"users",currentUser.uid),{
name,institution,year,email:currentUser.email
});

/* GROUP LOGIC */

const groupName = institution.toLowerCase()+"-"+year;

let groupId=null;

const groupsSnap = await getDocs(collection(db,"groups"));

groupsSnap.forEach(d=>{
if(d.data().name===groupName){
groupId=d.id;
}
});

if(!groupId){
const g = await addDoc(collection(db,"groups"),{
name:groupName,
displayName: institution+" - "+year
});
groupId = g.id;
}

/* CHECK MEMBER */

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

}catch(e){
alert(e.message);
}

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

/* FRIEND REQUEST + NOTIFICATION */

window.addFriend = async(uid)=>{

await addDoc(collection(db,"friendRequests"),{
from:currentUser.uid,
to:uid,
status:"pending",
time:Date.now()
});

await addDoc(collection(db,"notifications"),{
userId:uid,
text: currentUser.displayName + " sent you a friend request",
time:Date.now()
});

alert("Request Sent ✅");

};

/* LOAD FRIENDS */

async function loadFriends(){

let html="";

/* FRIENDS */

const snap=await getDocs(collection(db,"friends"));

snap.forEach(d=>{
let f=d.data();

if(f.user1===currentUser.uid){
html+=`<div class="card">
Friend
<button onclick="openChat('${f.user2}')">Chat</button>
</div>`;
}

if(f.user2===currentUser.uid){
html+=`<div class="card">
Friend
<button onclick="openChat('${f.user1}')">Chat</button>
</div>`;
}

});

/* REQUESTS */

const req=await getDocs(collection(db,"friendRequests"));

req.forEach(d=>{
let r=d.data();

if(r.to===currentUser.uid && r.status==="pending"){
html+=`<div class="card">
Friend Request
<button onclick="acceptRequest('${d.id}','${r.from}')">Accept</button>
<button onclick="rejectRequest('${d.id}')">Reject</button>
</div>`;
}
});

document.getElementById("friendsList").innerHTML=html;

};

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
text: currentUser.displayName + " accepted your request"
});

alert("Friend Added");

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

let text=prompt("Send message");

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

const members=await getDocs(collection(db,"groupMembers"));
const groups=await getDocs(collection(db,"groups"));

let html="";

members.forEach(m=>{
let mem=m.data();

if(mem.userId===currentUser.uid){

groups.forEach(g=>{
if(g.id===mem.groupId){
html+=`<div class="card">
${g.data().displayName || g.data().name}
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

/* LIKE COUNT */

let likesSnap=await getDocs(collection(db,"memoryLikes"));
let count=0;

likesSnap.forEach(l=>{
if(l.data().memoryId===d.id){
count++;
}
});

/* COMMENTS */

let commentsSnap=await getDocs(collection(db,"memoryComments"));
let comments="";

commentsSnap.forEach(c=>{
let cm=c.data();
if(cm.memoryId===d.id){
comments+=`<div>${cm.userName}: ${cm.comment}</div>`;
}
});

html+=`<div class="card">
${m.caption}
<br>❤️ ${count}
<br><button onclick="likeMemory('${d.id}')">Like</button>
<br><input id="c-${d.id}">
<button onclick="commentMemory('${d.id}')">Send</button>
${comments}
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

/* COMMENT */

window.commentMemory = async(id)=>{

let text=document.getElementById("c-"+id).value;

if(!text) return;

await addDoc(collection(db,"memoryComments"),{
memoryId:id,
userName:currentUser.displayName,
comment:text
});

document.getElementById("c-"+id).value="";
};
