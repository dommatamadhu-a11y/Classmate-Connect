import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
GoogleAuthProvider,
signInWithRedirect,
getRedirectResult,
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
deleteDoc,
query,
where,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// FIREBASE CONFIG
const firebaseConfig = {
apiKey: "AIzaSyAK01_ZKFoPQQrpFqoRnlvuH0iVXLF7mqA",
authDomain: "classmate-connect-4ef14.firebaseapp.com",
projectId: "classmate-connect-4ef14",
storageBucket: "classmate-connect-4ef14.appspot.com",
messagingSenderId: "836999548178",
appId: "1:836999548178:web:8fc82fcf07289647c5f7cb"
};


// INITIALIZE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

let currentUser;
let chatUser;
let profileUser;


// GOOGLE LOGIN
window.googleLogin = function () {
signInWithRedirect(auth, provider);
};


// AFTER REDIRECT LOGIN
getRedirectResult(auth)
.then((result) => {

if (result) {

currentUser = result.user;

document.getElementById("login").style.display = "none";
document.getElementById("profile").style.display = "block";

loadRequests();
loadFriends();

}

})
.catch((error) => {
console.log(error);
});


// LOGOUT
window.logout = async function(){

await signOut(auth);

location.reload();

};


// SAVE PROFILE
window.saveProfile = async function(){

let name = document.getElementById("name").value;
let school = document.getElementById("school").value;
let year = document.getElementById("year").value;
let city = document.getElementById("city").value;

await setDoc(doc(db,"users",currentUser.uid),{

name:name,
school:school,
year:year,
city:city

});

showSection("find");

};


// FIND USERS
window.findUsers = async function(){

let school = document.getElementById("searchSchool").value.toLowerCase();
let year = document.getElementById("searchYear").value;

let snapshot = await getDocs(collection(db,"users"));

let html="";

snapshot.forEach(docu=>{

let d = docu.data();

if(docu.id!==currentUser.uid && d.school.toLowerCase().includes(school) && d.year==year){

let letter = d.name.charAt(0).toUpperCase();

html+=`

<div class="card">

<div onclick="viewProfile('${docu.id}')">

${letter} ${d.name}

</div>

<button onclick="sendRequest('${docu.id}')">Add</button>

</div>

`;

}

});

document.getElementById("results").innerHTML=html;

};


// SEND FRIEND REQUEST
window.sendRequest = async function(id){

await addDoc(collection(db,"friendRequests"),{

from:currentUser.uid,
to:id,
time:Date.now()

});

alert("Friend request sent");

};


// LOAD FRIEND REQUESTS
function loadRequests(){

const q = query(collection(db,"friendRequests"),where("to","==",currentUser.uid));

onSnapshot(q,(snapshot)=>{

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

html+=`

<div class="card">

${d.from}

<button onclick="acceptRequest('${docu.id}','${d.from}')">Accept</button>

</div>

`;

});

document.getElementById("requestList").innerHTML=html;

});

}


// ACCEPT REQUEST
window.acceptRequest = async function(id,from){

await addDoc(collection(db,"friends"),{

user1:currentUser.uid,
user2:from

});

await deleteDoc(doc(db,"friendRequests",id));

};


// LOAD FRIENDS
function loadFriends(){

const q=query(collection(db,"friends"));

onSnapshot(q,(snapshot)=>{

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

let friend=null;

if(d.user1==currentUser.uid) friend=d.user2;
if(d.user2==currentUser.uid) friend=d.user1;

if(friend){

html+=`

<div class="card" onclick="viewProfile('${friend}')">

${friend}

</div>

`;

}

});

document.getElementById("friendsList").innerHTML=html;

});

}


// VIEW PROFILE
window.viewProfile = async function(id){

profileUser=id;

let docu=await getDoc(doc(db,"users",id));
let d=docu.data();

document.getElementById("pName").innerText=d.name;
document.getElementById("pSchool").innerText="School: "+d.school;
document.getElementById("pYear").innerText="Year: "+d.year;
document.getElementById("pCity").innerText="City: "+d.city;

showSection("profileView");

};


// START CHAT
window.startChat=function(){

chatUser=profileUser;

document.getElementById("chatName").innerText =
document.getElementById("pName").innerText;

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

let time=new Date(m.time).toLocaleTimeString();

html+=`

<div>

${m.text}

<div>${time}</div>

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
