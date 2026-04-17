const firebaseConfig = {
    apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
    authDomain: "class-connect-b58f0.firebaseapp.com",
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "class-connect-b58f0",
    storageBucket: "class-connect-b58f0.firebasestorage.app",
    messagingSenderId: "836461719745",
    appId: "1:836461719745:web:f827862e4db4954626a440"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const messaging = firebase.messaging();

let user = null;
let currentChatId = null;

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then(() => console.log("PWA Active"));
}

window.onload = () => { setTimeout(() => { document.getElementById('splash').style.display = 'none'; }, 2000); };

auth.onAuthStateChanged(u => {
    const overlay = document.getElementById('login-overlay');
    if(u) {
        overlay.style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "", skills: d.skills || "", fcmToken: d.fcmToken || "" };
            initApp();
        });
    } else { overlay.style.display = "flex"; }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

function initApp() { updateUI(); loadFeed(); loadLibrary(); loadCircle(); listenNotifs(); checkMemories(); autoGroupAlumni(); setupNotifications(); }

function setupNotifications() {
    const VAPID = 'BNppuFKd12JLfoyzxiLusI7RKlRZn65W9v4OnTul3hi2JkFJjUrrzNPml6cHaCxHG-fhgCj6cssnA8YExKGFPJM';
    messaging.getToken({ vapidKey: VAPID }).then(t => { if(t) db.ref(`users/${user.uid}`).update({ fcmToken: t }); });
    messaging.onMessage(p => { alert(`${p.notification.title}: ${p.notification.body}`); });
}

// WhatsApp Invite
function shareToWhatsApp() {
    const appUrl = window.location.href;
    const msg = `Hey! I found our old classmates on 'Classmate Connect Global'. Join the network here: ${appUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    if(!msg && !file) return;
    let post = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now() };
    if(file) post.media = await toBase64(file);
    db.ref('posts').push(post);
    document.getElementById('msgInput').value = "";
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('feed-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            cont.innerHTML = `
                <div class="card">
                    <b>${p.userName}</b><p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:10px;">` : ""}
                </div>` + cont.innerHTML;
        });
    });
}

function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    const year = document.getElementById('s-year').value;
    const uClass = document.getElementById('s-class').value.toLowerCase();
    const city = document.getElementById('s-city').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(u.inst.toLowerCase().includes(inst) && (!year || u.year == year) && u.uClass.toLowerCase().includes(uClass) && u.city.toLowerCase().includes(city)) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between;">
                    <div><b>${u.name}</b><br><small>${u.city}</small></div>
                    <button onclick="sendReq('${c.key}')" class="btn" style="width:80px; padding:5px;">Connect</button>
                </div>`;
            }
        });
    });
}

function updateProfile() {
    const d = { 
        name: document.getElementById('p-name').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        uClass: document.getElementById('p-class').value, 
        city: document.getElementById('p-city').value, 
        skills: document.getElementById('p-skills').value 
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Synced!"));
}

function autoGroupAlumni() {
    if(!user.inst || !user.year) return;
    const gid = `${user.inst}_${user.year}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    db.ref(`groups/${gid}/info`).set({ name: `${user.inst} (${user.year})`, id: gid });
    db.ref(`groups/${gid}/members/${user.uid}`).set({ name: user.name });
    const cont = document.getElementById('auto-groups'); cont.innerHTML = `<div class="card"><i class="fas fa-university"></i> ${user.inst} - ${user.year} Group</div>`;
}

// Chatting, Library, Notifications follow same logic as previous robust code
function openPrivateChat(tid, tname) {
    currentChatId = user.uid < tid ? user.uid + "_" + tid : tid + "_" + user.uid;
    document.getElementById('chat-t-name').innerText = tname;
    document.getElementById('chat-window').style.display = "flex";
    db.ref(`chats/${currentChatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => { const m = s.val(); cont.innerHTML += `<div class="msg ${m.sender === user.uid ? 'sent' : 'received'}">${m.text}</div>`; });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendChatMessage() {
    const text = document.getElementById('chatInput').value;
    if(!text) return;
    db.ref(`chats/${currentChatId}`).push({ sender: user.uid, text, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function sendReq(tid) { db.ref(`notifications/${tid}`).push({ from: user.name, fromUid: user.uid }); alert("Request Sent!"); }

function listenNotifs() {
    db.ref(`notifications/${user.uid}`).on('value', snap => {
        const cont = document.getElementById('notif-list'); cont.innerHTML = "";
        snap.forEach(s => {
            const n = s.val();
            cont.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span>${n.from}</span>
                <button onclick="acceptReq('${s.key}','${n.fromUid}','${n.from}')" class="btn" style="width:70px; padding:4px;">Accept</button>
            </div>`;
        });
    });
}

function acceptReq(k, fuid, fname) {
    db.ref(`friends/${user.uid}/${fuid}`).set({ name: fname });
    db.ref(`friends/${fuid}/${user.uid}`).set({ name: user.name });
    db.ref(`notifications/${user.uid}/${k}`).remove();
}

function loadCircle() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => { fl.innerHTML += `<div class="card" onclick="openPrivateChat('${s.key}','${s.val().name}')">${s.val().name}</div>`; });
    });
}

function checkMemories() {
    db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
        snap.forEach(s => {
            const p = s.val(); const d = new Date(p.time); const n = new Date();
            if(d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() < n.getFullYear()) {
                document.getElementById('mem-banner').style.display = "block";
                document.getElementById('mem-text').innerText = p.msg;
            }
        });
    });
}

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = `Hi, ${user.name.split(' ')[0]}`;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
}

function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    el.classList.add('active-nav');
}

function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
