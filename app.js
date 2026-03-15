import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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

// Login
window.googleLogin=()=>signInWithRedirect(auth,provider);

// Auth State
onAuthStateChanged(auth,user=>{
if(user){
currentUser=user;
document.getElementById("login").style.display="none";
loadFriends();
loadChats();
loadGroups();
showSection("chats");
}else{
showSection("login");
}
});

// Logout
window.logout=async()=>{await signOut(auth);location.reload();};

// Save Profile & Auto Join Batch Group
window.saveProfile=async()=>{
const name=document.getElementById("name").value;
const nickname=document.getElementById("nickname").value;
const institution=document.getElementById("institution").value;
const course=document.getElementById("course").value;
const year=document.getElementById("year").value;
const city=document.getElementById("city").value;

if(!name || !institution || !course || !year) return alert("Fill all required fields");

await setDoc(doc(db,"users",currentUser.uid),{name,nickname,institution,course,year,city});

// Auto join batch group
const groupId=institution+"_"+course+"_"+year;
const groupRef=doc(db,"groups",groupId);
await setDoc(groupRef,{institution,course,year},{merge:true});
await setDoc(doc(db,"groupMembers",currentUser.uid+"_"+groupId),{groupId,userId:currentUser.uid});
alert("Profile saved & joined your batch group");
showSection("chats");
};

// Find Classmates
window.findClassmates=()=>{
const inst=document.getElementById("searchInstitution").value.toLowerCase();
const year=document.getElementById("searchYear").value;
const q=query(collection(db,"users"));
onSnapshot(q,snapshot=>{
let html="";
snapshot.forEach(docu=>{
let d=docu.data();
if(d.institution && d.institution.toLowerCase().includes(inst) &&
d.year && d.year.includes(year) && docu.id!==currentUser.uid){
html+=`<div class="card" onclick="openChat('${docu.id}','${d.name} (${d.nickname})')">${d.name} (${d.nickname}) - ${d.institution}</div>`;
}
});
document.getElementById("results").innerHTML=html;
});
};

// Friends List
function loadFriends(){
const q=query(collection(db,"users"));
onSnapshot(q,snapshot=>{
let html="";
snapshot.forEach(docu=>{
let d=docu.data();
if(docu.id!==currentUser.uid){
html+=`<div class="card" onclick="openChat('${docu.id}','${d.name}')">${d.name}</div>`;
}
});
document.getElementById("friendsList").innerHTML=html;
});
}

// Chat List
function loadChats(){
const q=query(collection(db,"messages"));
onSnapshot(q,snapshot=>{
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
html+=`<div class="card" onclick="openChat('${id}','User')">${chats[id]}</div>`;
}
document.getElementById("chatList").innerHTML=html;
});
}

// Open Chat
window.openChat=(uid,name)=>{
chatUser=uid;
document.getElementById("chatName").innerText=name;
showSection("chatScreen");
loadMessages();
}

// Send Text Message
window.sendMsg=async()=>{
let text=document.getElementById("msgInput").value;
if(text==="") return;
await addDoc(collection(db,"messages"),{from:currentUser.uid,to:chatUser,text,text,image:"",time:Date.now()});
document.getElementById("msgInput").value="";
}

// Pick Image
window.pickImage=()=>document.getElementById("imgFile").click();

document.getElementById("imgFile").addEventListener("change",async(e)=>{
let file=e.target.files[0];
if(!file) return;
let storageRef=ref(storage,"chatImages/"+Date.now());
await uploadBytes(storageRef,file);
let url=await getDownloadURL(storageRef);
await addDoc(collection(db,"messages"),{from:currentUser.uid,to:chatUser,text:"",image:url,time:Date.now()});
});

// Load Messages
function loadMessages(){
const q=query(collection(db,"messages"));
onSnapshot(q,snapshot=>{
let html="";
snapshot.forEach(docu=>{
let m=docu.data();
if((m.from===currentUser.uid && m.to===chatUser) || (m.from===chatUser && m.to===currentUser.uid)){
let cls=m.from===currentUser.uid?"msg me":"msg other";
if(m.image){html+=`<div class="${cls}"><img src="${m.image}"></div>`;}
else{html+=`<div class="${cls}">${m.text}</div>`;}
}
});
document.getElementById("chatBox").innerHTML=html;
});
}

// Groups
function loadGroups(){
onSnapshot(collection(db,"groups"),snapshot=>{
let html="";
snapshot.forEach(docu=>{
let g=docu.data();
let groupId=docu.id;
const memberRef=doc(db,"groupMembers",currentUser.uid+"_"+groupId);
onSnapshot(memberRef,snap=>{
if(snap.exists()){
html+=`<div class="card" onclick="openGroupChat('${groupId}','${g.institution} - ${g.course} - ${g.year}')">${g.institution} - ${g.course} - ${g.year}</div>`;
document.getElementById("groupList").innerHTML=html;
}
});
});
});
}

// Open Group Chat
window.openGroupChat=async(groupId,name)=>{
chatUser=null; // null for group chat
document.getElementById("chatName").innerText=name;
showSection("chatScreen");
// For group chat, you can fetch messages where groupId matches
}

// Show Section
window.showSection=id=>{
document.querySelectorAll(".section").forEach(s=>s.style.display="none");
document.getElementById(id).style.display="block";
};
