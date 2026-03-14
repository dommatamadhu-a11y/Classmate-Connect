import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth, GoogleAuthProvider, signInWithPopup }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
getFirestore,
doc,
setDoc,
getDocs,
collection,
addDoc,
query,
where,
updateDoc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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



// GOOGLE LOGIN

window.googleLogin = function(){

signInWithPopup(auth,provider)

.then((result)=>{

currentUser = result.user;

document.getElementById("login").style.display="none";

document.getElementById("profile").style.display="block";

})

.catch((error)=>{

alert(error.message);

});

};



// SAVE PROFILE

window.saveProfile = async function(){

let name=document.getElementById("name").value;

let school=document.getElementById("school").value;

let year=document.getElementById("year").value;

let city=document.getElementById("city").value;

await setDoc(doc(db,"users",currentUser.uid),{

name:name,

school:school,

year:year,

city:city

});

alert("Profile saved");

document.getElementById("profile").style.display="none";

document.getElementById("find").style.display="block";

};



// FIND USERS

window.findUsers = async function(){

let school=document.getElementById("searchSchool").value.toLowerCase();

let year=document.getElementById("searchYear").value;

let snapshot=await getDocs(collection(db,"users"));

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

if(d.school.toLowerCase().includes(school) && d.year==year){

html+=`

<div class="card">

<b>${d.name}</b><br>

${d.school}<br>

${d.city}<br>

<button onclick="sendFriendRequest('${docu.id}')">

Add Friend

</button>

</div>

`;

}

});

document.getElementById("results").innerHTML=html;

};



// SEND FRIEND REQUEST

window.sendFriendRequest = async function(targetId){

await addDoc(collection(db,"friendRequests"),{

from:currentUser.uid,

to:targetId,

status:"pending"

});

alert("Friend request sent");

};



// LOAD FRIEND REQUESTS

window.loadFriendRequests = async function(){

let q=query(

collection(db,"friendRequests"),

where("to","==",currentUser.uid)

);

let snapshot=await getDocs(q);

let html="";

snapshot.forEach(req=>{

let d=req.data();

html+=`

<div class="card">

Friend request from: ${d.from}

<br>

<button onclick="acceptRequest('${req.id}')">

Accept

</button>

</div>

`;

});

document.getElementById("requestList").innerHTML=html;

};



// ACCEPT REQUEST

window.acceptRequest = async function(id){

await updateDoc(doc(db,"friendRequests",id),{

status:"accepted"

});

alert("Friend added");

};



// SHOW SECTION

window.showSection=function(id){

document.querySelectorAll(".section")

.forEach(s=>s.style.display="none");

document.getElementById(id).style.display="block";

if(id==="requests"){

loadFriendRequests();

}

};
