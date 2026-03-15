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
query,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
getStorage,
ref,
uploadBytes,
getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


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

const storage=getStorage(app);

const provider=new GoogleAuthProvider();

let currentUser;

let chatUser;


// LOGIN
window.googleLogin=function(){
signInWithRedirect(auth,provider);
};


// AUTH
onAuthStateChanged(auth,(user)=>{

if(user){

currentUser=user;

document.getElementById("login").style.display="none";

loadFriends();
loadChats();

showSection("chats");

}else{

showSection("login");

}

});


// LOGOUT
window.logout=async function(){

await signOut(auth);

location.reload();

};


// FRIEND LIST
function loadFriends(){

const q=query(collection(db,"users"));

onSnapshot(q,(snapshot)=>{

let html="";

snapshot.forEach(docu=>{

let d=docu.data();

if(docu.id!==currentUser.uid){

html+=`

<div class="card" onclick="openChat('${docu.id}','${d.name}')">
${d.name}
</div>

`;

}

});

document.getElementById("friendsList").innerHTML=html;

});

}


// CHAT LIST
function loadChats(){

const q=query(collection(db,"messages"));

onSnapshot(q,(snapshot)=>{

let chats={};

snapshot.forEach(docu=>{

let m=docu.data();

if(m.from===currentUser.uid || m.to===currentUser.uid){

let friend=m.from===currentUser.uid?m.to:m.from;

chats[friend]=m.text || "📷 Image";

}

});

let html="";

for(let id in chats){

html+=`

<div class="card" onclick="openChat('${id}','User')">
${chats[id]}
</div>

`;

}

document.getElementById("chatList").innerHTML=html;

});

}


// OPEN CHAT
window.openChat=function(uid,name){

chatUser=uid;

document.getElementById("chatName").innerText=name;

showSection("chatScreen");

loadMessages();

};


// SEND TEXT MESSAGE
window.sendMsg=async function(){

let text=document.getElementById("msgInput").value;

if(text==="") return;

await addDoc(collection(db,"messages"),{

from:currentUser.uid,
to:chatUser,
text:text,
image:"",
time:Date.now()

});

document.getElementById("msgInput").value="";

};


// PICK IMAGE
window.pickImage=function(){

document.getElementById("imgFile").click();

};


document.getElementById("imgFile").addEventListener("change",async(e)=>{

let file=e.target.files[0];

if(!file) return;

let storageRef=ref(storage,"chatImages/"+Date.now());

await uploadBytes(storageRef,file);

let url=await getDownloadURL(storageRef);

await addDoc(collection(db,"messages"),{

from:currentUser.uid,
to:chatUser,
text:"",
image:url,
time:Date.now()

});

});


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

if(m.image){

html+=`
<div class="${cls}">
<img src="${m.image}">
</div>
`;

}else{

html+=`
<div class="${cls}">
${m.text}
</div>
`;

}

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
