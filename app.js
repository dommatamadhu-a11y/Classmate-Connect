import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
GoogleAuthProvider,
signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
getFirestore,
doc,
setDoc,
getDoc,
getDocs,
collection,
addDoc,
query,
where,
updateDoc,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {

apiKey:"AIzaSyAK01_ZKFoPQQrpFqoRnlvuH0iVXLF7mqA",
authDomain:"classmate-connect-4ef14.firebaseapp.com",
projectId:"classmate-connect-4ef14",
storageBucket:"classmate-connect-4ef14.appspot.com",
messagingSenderId:"836999548178",
appId:"1:836999548178:web:8fc82fcf07289647c5f7cb"

};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser;
let chatUser;


// LOGIN

window.googleLogin=function(){

signInWithPopup(auth,provider)

.then(async(result)=>{

currentUser=result.user;

await setDoc(doc(db,"users",currentUser.uid),{

online:true

},{merge:true});

document.getElementById("login").style.display="none";
document.getElementById("profile").style.display="block";

});

};



// SAVE PROFILE

window.saveProfile=async function(){

let name=document.getElementById("name").value;
let school=document.getElementById("school").value;
let year=document.getElementById("year").value;
let city=document.getElementById("city").value;

await setDoc(doc(db,"users",currentUser.uid),{

name:name,
school:school,
year:year,
city:city,
online:true

},{merge:true});

showSection("find");

};



// FIND USERS

window.findUsers=async function(){

let school=document.getElementById("searchSchool").value.toLowerCase();
let year=document.getElementById("searchYear").value;

let snapshot=await getDocs(collection(db,"users"));

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

if(docu.id!==currentUser.uid && d.school.toLowerCase().includes(school) && d.year==year){

let letter=d.name.charAt(0).toUpperCase();

html+=`

<div class="card">

<div class="row">

<div class="avatar">${letter}</div>

<div>

<div>${d.name}</div>
<div>${d.city}</div>

</div>

</div>

<button onclick="sendRequest('${docu.id}')">Add</button>

</div>

`;

}

});

document.getElementById("results").innerHTML=html;

};



// FRIEND REQUEST

window.sendRequest=async function(id){

await addDoc(collection(db,"friendRequests"),{

from:currentUser.uid,
to:id,
status:"pending",
time:Date.now()

});

alert("Request sent");

};



// LOAD REQUESTS

window.loadRequests=function(){

const q=query(
collection(db,"friendRequests"),
where("to","==",currentUser.uid),
where("status","==","pending")
);

onSnapshot(q,(snapshot)=>{

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

html+=`

<div class="card">

${d.from}

<button onclick="acceptRequest('${docu.id}','${d.from}')">
Accept
</button>

</div>

`;

});

document.getElementById("requestList").innerHTML=html;

});

};



// ACCEPT REQUEST

window.acceptRequest=async function(id,from){

await addDoc(collection(db,"friends"),{

user1:currentUser.uid,
user2:from

});

await updateDoc(doc(db,"friendRequests",id),{

status:"accepted"

});

};



// CHAT LIST

window.loadChats=function(){

onSnapshot(collection(db,"messages"),async(snapshot)=>{

let chats={};

snapshot.forEach(docu=>{

let m=docu.data();

if(m.from===currentUser.uid || m.to===currentUser.uid){

let friend=m.from===currentUser.uid?m.to:m.from;

if(!chats[friend] || chats[friend].time<m.time){

chats[friend]=m;

}

}

});

let html="";

for(let id in chats){

let userDoc=await getDoc(doc(db,"users",id));

let user=userDoc.data();

let letter=user.name.charAt(0).toUpperCase();

let last=chats[id].text;

let time=new Date(chats[id].time).toLocaleTimeString();

html+=`

<div class="card" onclick="openChat('${id}')">

<div class="row">

<div class="avatar">${letter}</div>

<div>

<div>${user.name}</div>
<div style="font-size:12px;color:gray">${last}</div>

</div>

</div>

<div style="font-size:11px;color:gray">${time}</div>

</div>

`;

}

document.getElementById("chatList").innerHTML=html;

});

};



// OPEN CHAT

window.openChat=function(id){

chatUser=id;

document.getElementById("chatName").innerText=id;

showSection("chatScreen");

loadMessages();

};



// SEND MESSAGE

window.sendMsg=async function(){

let text=document.getElementById("msgInput").value;

await addDoc(collection(db,"messages"),{

from:currentUser.uid,
to:chatUser,
text:text,
time:Date.now()

});

document.getElementById("msgInput").value="";

};



// LOAD MESSAGES

function loadMessages(){

const q=query(collection(db,"messages"));

onSnapshot(q,(snapshot)=>{

let html="";

snapshot.forEach(docu=>{

let m=docu.data();

if(
(m.from===currentUser.uid && m.to===chatUser) ||
(m.from===chatUser && m.to===currentUser.uid)
){

let cls=m.from===currentUser.uid?"msg me":"msg other";

let time=new Date(m.time).toLocaleTimeString();

html+=`

<div class="${cls}">

${m.text}

<div class="time">${time}</div>

</div>

`;

}

});

document.getElementById("chatBox").innerHTML=html;

});

}



// TYPING

window.typing=async function(){

await setDoc(doc(db,"typing",chatUser),{

user:currentUser.uid

});

};



// SHOW SECTION

window.showSection=function(id){

document.querySelectorAll(".section").forEach(s=>s.style.display="none");

document.getElementById(id).style.display="block";

if(id==="requests") loadRequests();
if(id==="chats") loadChats();

};
