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
window.googleLogin = ()=>{
signInWithRedirect(auth,provider);
};

/* AUTH */
onAuthStateChanged(auth,user=>{
if(user){
currentUser=user;
showSection("find");
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
if(!currentUser && id!=="login") return;
document.querySelectorAll(".section").forEach(s=>s.style.display="none");
document.getElementById(id).style.display="block";
};

/* PROFILE */
window.saveProfile = async ()=>{
const name=nameInput.value;
const institution=institutionInput.value;
const year=yearInput.value;
const city=cityInput.value;

await setDoc(doc(db,"users",currentUser.uid),{
name,institution,year,city,email:currentUser.email
});

alert("Profile saved");
};

/* FIND USERS */
window.loadUsers = async ()=>{
const inst=searchInstitution.value;
const year=searchYear.value;
const city=searchCity.value;

const snap=await getDocs(collection(db,"users"));

let html="";

snap.forEach(d=>{
let u=d.data();

if(
d.id!==currentUser.uid &&
u.institution===inst &&
u.year===year &&
u.city===city
){
html+=`
<div class="card">
${u.name}
<button onclick="sendFriendRequest('${d.id}')">
Send Friend Request
</button>
</div>`;
}
});

findList.innerHTML=html;
};

/* SEND REQUEST */
window.sendFriendRequest = async(uid)=>{

await addDoc(collection(db,"friendRequests"),{
from:currentUser.uid,
to:uid,
status:"pending"
});

/* NOTIFICATION */
await addDoc(collection(db,"notifications"),{
userId:uid,
text: currentUser.displayName+" sent you request"
});

alert("Request sent ✅");

};

/* NOTIFICATIONS */
function loadNotifications(){

onSnapshot(collection(db,"notifications"),snap=>{

let html="";

snap.forEach(d=>{
let n=d.data();

if(n.userId===currentUser.uid){
html+=`<div class="card">🔔 ${n.text}</div>`;
}
});

notificationsList.innerHTML=html;

});
}
