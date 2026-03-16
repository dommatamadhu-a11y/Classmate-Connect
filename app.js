import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, query, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

window.googleLogin = () => signInWithRedirect(auth, provider);

onAuthStateChanged(auth,user=>{
if(user){
currentUser=user;
loadNotifications();
}
});

window.logout = async () => {
await signOut(auth);
location.reload();
};

async function createNotification(userId,text){

await addDoc(collection(db,"notifications"),{
userId:userId,
text:text,
time:Date.now(),
read:false
});

}

window.likeMemory = async(memoryId,ownerId)=>{

await addDoc(collection(db,"memoryLikes"),{
memoryId:memoryId,
userId:currentUser.uid
});

createNotification(ownerId,currentUser.displayName+" liked your memory");

};

window.commentMemory = async(memoryId,ownerId)=>{

let comment=document.getElementById("commentInput").value;

if(comment==="") return;

await addDoc(collection(db,"memoryComments"),{
memoryId:memoryId,
userName:currentUser.displayName,
comment:comment,
time:Date.now()
});

createNotification(ownerId,currentUser.displayName+" commented on your memory");

document.getElementById("commentInput").value="";

};

function loadNotifications(){

const q=query(collection(db,"notifications"));

onSnapshot(q,snapshot=>{

let html="";

snapshot.forEach(docu=>{

let n=docu.data();

if(n.userId===currentUser.uid){

html+=`<div class="card">${n.text}</div>`;

}

});

document.getElementById("notificationsList").innerHTML=html;

});

}
