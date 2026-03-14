import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
GoogleAuthProvider,
signInWithPopup,
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
let profileUser;


window.googleLogin=function(){

signInWithPopup(auth,provider)

.then((result)=>{

currentUser=result.user;

document.getElementById("login").style.display="none";
document.getElementById("profile").style.display="block";

});

};


window.logout=async function(){

await signOut(auth);

currentUser=null;

document.querySelectorAll(".section").forEach(s=>s.style.display="none");

document.getElementById("login").style.display="block";

alert("Logged out");

};


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

<div class="card" onclick="viewProfile('${docu.id}')">

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


window.viewProfile=async function(id){

profileUser=id;

let docu=await getDoc(doc(db,"users",id));
let d=docu.data();

document.getElementById("pName").innerText=d.name;
document.getElementById("pSchool").innerText="School: "+d.school;
document.getElementById("pYear").innerText="Year: "+d.year;
document.getElementById("pCity").innerText="City: "+d.city;

showSection("profileView");

};


window.startChat=function(){

chatUser=profileUser;

document.getElementById("chatName").innerText=
document.getElementById("pName").innerText;

showSection("chatScreen");

loadMessages();

};


window.sendRequest=async function(id){

await addDoc(collection(db,"friendRequests"),{

from:currentUser.uid,
to:id,
status:"pending",
time:Date.now()

});

alert("Request sent");

};


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


window.showSection=function(id){

document.querySelectorAll(".section").forEach(s=>s.style.display="none");

document.getElementById(id).style.display="block";

};
