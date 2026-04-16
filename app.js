// Firebase Config
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

// Splash Screen
window.onload = () => { setTimeout(() => { document.getElementById('splash').style.display = 'none'; }, 2000); };

// Auth Listener
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { 
                uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, 
                inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", 
                city: d.city || "", skills: d.skills || "", fcmToken: d.fcmToken || ""
            };
            initApp();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function initApp() {
    updateUI(); loadFeed(); loadLibrary(); loadCircle(); listenNotifs(); 
    checkMemories(); autoGroupAlumni(); initNotifications();
}

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
}

// Push Notifications & VAPID Key
function initNotifications() {
    const vapKey = 'BNppuFKd12JLfoyzxiLusI7RKlRZn65W9v4OnTul3hi2JkFJjUrrzNPml6cHaCxHG-fhgCj6cssnA8YExKGFPJM';
    messaging.getToken({ vapidKey: vapKey }).then((t) => {
        if (t && user.fcmToken !== t) {
            db.ref(`users/${user.uid}`).update({ fcmToken: t });
        }
    }).catch(e => console.log("FCM Error", e));

    messaging.onMessage((payload) => {
        alert(`${payload.notification.title}: ${payload.notification.body}`);
    });
}

// Posting Logic
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    if(!msg && !file) return;

    let post = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg: msg, time: Date.now() };
    if(file) post.media = await toBase64(file);
    db.ref('posts').push(post);
    document.getElementById('msgInput').value = "";
    document.getElementById('f-post').value = "";
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('feed-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            cont.innerHTML = `
                <div class="card">
                    <b>${p.userName}</b><p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:8px;">` : ""}
                </div>` + cont.innerHTML;
        });
    });
}

// Search with 4 Boxes
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
                    <button onclick="sendReq('${c.key}')" class="btn" style="width:80px;">Connect</button>
                </div>`;
            }
        });
    });
}

// Automatic Groups
function autoGroupAlumni() {
    if(user.inst && user.year && user.uClass && user.city) {
        const gid = `${user.inst}_${user.year}_${user.uClass}_${user.city}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        db.ref(`groups/${gid}/info`).set({ name: `${user.inst} Group`, id: gid });
        db.ref(`groups/${gid}/members/${user.uid}`).set({ name: user.name, photo: user.photo });
        
        db.ref('groups').on('value', snap => {
            const cont = document.getElementById('auto-groups'); cont.innerHTML = "";
            snap.forEach(s => {
                const g = s.val();
                if(g.members && g.members[user.uid]) {
                    cont.innerHTML += `<div class="card"><i class="fas fa-users"></i> ${g.info.name}</div>`;
                }
            });
        });
    }
}

// Private Chatting
function openPrivateChat(tid, tname) {
    currentChatId = user.uid < tid ? user.uid + "_" + tid : tid + "_" + user.uid;
    document.getElementById('chat-t-name').innerText = tname;
    document.getElementById('chat-window').style.display = "flex";
    db.ref(`chats/${currentChatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            cont.innerHTML += `<div class="${m.sender === user.uid ? 'msg-sent' : 'msg-received'}">${m.text}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendChatMessage() {
    const text = document.getElementById('chatInput').value;
    if(!text) return;
    db.ref(`chats/${currentChatId}`).push({ sender: user.uid, text: text, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }

// Digital Library
async function uploadToLibrary() {
    const title = document.getElementById('lib-title').value;
    const file = document.getElementById('f-lib').files[0];
    if(!title || !file) return;
    const b64 = await toBase64(file);
    db.ref('library').push({ title, file: b64, uploader: user.name });
}

function loadLibrary() {
    db.ref('library').on('value', snap => {
        const list = document.getElementById('library-list'); list.innerHTML = "";
        snap.forEach(s => {
            const d = s.val();
            list.innerHTML += `<div class="card"><i class="fas fa-file-alt"></i> ${d.title} <br><small>By: ${d.uploader}</small></div>`;
        });
    });
}

// Circle & Notifications
function sendReq(tid) { db.ref(`notifications/${tid}`).push({ from: user.name, fromUid: user.uid }); alert("Request Sent!"); }
function listenNotifs() {
    db.ref(`notifications/${user.uid}`).on('value', snap => {
        const cont = document.getElementById('notif-list'); cont.innerHTML = "";
        snap.forEach(s => {
            const n = s.val();
            cont.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span>${n.from} wants to connect</span>
                <button onclick="acceptReq('${s.key}','${n.fromUid}','${n.from}')" class="btn" style="width:70px; padding:5px;">Accept</button>
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
        const cont = document.getElementById('friends-list'); cont.innerHTML = "";
        snap.forEach(s => {
            cont.innerHTML += `<div class="card" onclick="openPrivateChat('${s.key}','${s.val().name}')"><i class="fas fa-user"></i> ${s.val().name}</div>`;
        });
    });
}

// Profile Sync
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

// Memories
function checkMemories() {
    db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
        snap.forEach(s => {
            const p = s.val(); const d = new Date(p.time); const now = new Date();
            if(d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear()) {
                document.getElementById('mem-banner').style.display = "block";
                document.getElementById('mem-text').innerText = p.msg;
            }
        });
    });
}

// Utils
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    el.classList.add('active-nav');
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
