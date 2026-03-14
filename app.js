import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore, doc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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

${d.city}

</div>

`;

}

});

document.getElementById("results").innerHTML=html;

};
