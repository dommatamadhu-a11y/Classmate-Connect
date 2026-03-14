import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getFirestore,
collection,
doc,
setDoc,
addDoc,
getDoc,
getDocs,
query,
where,
onSnapshot,
orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
getAuth,
RecaptchaVerifier,
signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {

apiKey: "AIzaSyAK01_ZKFoPQQrpFqoRnlvuH0iVXLF7mqA",

authDomain: "classmate-connect-4ef14.firebaseapp.com",

projectId: "classmate-connect-4ef14",

storageBucket: "classmate-connect-4ef14.firebasestorage.app",

messagingSenderId: "836999548178",

appId: "1:836999548178:web:8fc82fcf07289647c5f7cb"

};

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

let currentUser
let chatUser
let confirmationResult

window.showSection=function(id){

document.querySelectorAll(".section").forEach(s=>s.style.display="none")

document.getElementById(id).style.display="block"

}

window.recaptcha = new RecaptchaVerifier(auth,"recaptcha",{size:"normal"})

window.sendOTP = async function(){

let phone=document.getElementById("phone").value

confirmationResult = await signInWithPhoneNumber(auth,phone,recaptcha)

alert("OTP Sent")

}

window.verifyOTP = async function(){

let code=document.getElementById("otp").value

let result=await confirmationResult.confirm(code)

currentUser=result.user.phoneNumber

checkProfile()

}

async function checkProfile(){

const ref = doc(db,"users",currentUser)

const snap = await getDoc(ref)

if(snap.exists()){

showSection("find")

}else{

showSection("profile")

}

}

window.saveProfile = async function(){

await setDoc(doc(db,"users",currentUser),{

name:name.value,
institution:institution.value.toLowerCase(),
class:class.value,
year:year.value,
city:city.value,
type:type.value

})

alert("Profile saved")

showSection("find")

}

window.findUsers = async function(){

let inst = searchInstitution.value.toLowerCase()

let yr = searchYear.value

let snap = await getDocs(collection(db,"users"))

let html=""

snap.forEach(docSnap=>{

let d=docSnap.data()

if(docSnap.id!==currentUser && d.institution.includes(inst) && d.year==yr){

let letter=d.name.charAt(0).toUpperCase()

html+=`

<div class="card">

<div class="row">

<div class="avatar">${letter}</div>

<div>

<div>${d.name}</div>

<div>${d.class} - ${d.year}</div>

<b>${d.institution}</b>

</div>

</div>

<button onclick="sendRequest('${docSnap.id}')">Add</button>

</div>

`

}

})

results.innerHTML=html

}

window.sendRequest = async function(id){

await addDoc(collection(db,"friendRequests"),{

from:currentUser,
to:id,
status:"pending",
time:Date.now()

})

alert("Request sent")

}
