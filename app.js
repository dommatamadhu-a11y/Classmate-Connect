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
getDocs,
collection,
addDoc,
query,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig={
apiKey:"AIzaSyAK01_ZKFoPQQrpFqoRnlvuH0iVXLF7mqA",
authDomain:"classmate-connect-4ef14.firebaseapp.com",
projectId:"classmate-connect-4ef14",
storageBucket:"classmate-connect-4ef14.appspot.com",
messagingSenderId:"836999548178",
appId:"1:836999548178:web:8fc82fcf07289647c5f7cb"
};

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

const provider=new GoogleAuthProvider();

let currentUser;
let chatUser;


// LOGIN
window.googleLogin=function(){
signInWithRedirect(auth,provider);
};


// AUTH STATE
onAuthStateChanged(auth,async(user)=>{

if(user){

currentUser=user;

document.getElementById("login").style.display="none";

await setDoc(doc(db,"users",user.uid),{
online:true
},{merge:true});

loadFriends();

showSection("friends");

}else{

showSection("login");

}

});


// LOGOUT
window.logout=async function(){

await setDoc(doc(db,"users",currentUser.uid),{
online:false
},{merge:true});

await signOut(auth);

location.reload();

};


// SAVE PROFILE
window.saveProfile=async function(){

let name=document.getElementById("name").value;
let school=document.getElementById("school").value;
let year=document.getElementById("year").value;
let city=document.getElementById("city").value;

await setDoc(doc(db,"users",currentUser.uid),{

name,
school,
year,
city,
online:true

});

showSection("find");

};


// FIND USERS
window.findUsers=async function(){

let snapshot=await getDocs(collection(db,"users"));

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

if(docu.id!==currentUser.uid){

html+=`

<div class="card">

${d.name}

<button onclick="startChat('${docu.id}','${d.name}')">Chat</button>

</div>

`;

}

});

document.getElementById("results").innerHTML=html;

};


// LOAD FRIENDS
function loadFriends(){

const q=query(collection(db,"users"));

onSnapshot(q,(snapshot)=>{

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

if(docu.id!==currentUser.uid){

let status=d.online
? "<span class='online'>Online</span>"
: "<span class='offline'>Offline</span>";

html+=`

<div class="card" onclick="startChat('${docu.id}','${d.name}')">

<div>

<b>${d.name}</b><br>
${status}

</div>

<span class="badge">•</span>

</div>

`;

}

});

document.getElementById("friendsList").innerHTML=html;

});

}


// START CHAT
window.startChat=async function(uid,name){

chatUser=uid;

document.getElementById("chatName").innerText=name;

let docSnap=await getDoc(doc(db,"users",uid));

let status=docSnap.data().online
? "Online"
: "Offline";

document.getElementById("chatStatus").innerText=status;

showSection("chatScreen");

loadMessages();

};


// SEND MESSAGE
window.sendMsg=async function(){

let text=document.getElementById("msgInput").value;

await addDoc(collection(db,"messages"),{

from:currentUser.uid,
to:chatUser,
text,
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

html+=`

<div class="${cls}">
${m.text}
</div>

`;

}

});

document.getElementById("chatBox").innerHTML=html;

});

}


// SHOW SECTION
window.showSection=function(id){

document.querySelectorAll(".section").forEach(s=>s.style.display="none");

document.getElementById(id).style.display="block";

};
