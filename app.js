// 1. Core System Configuration
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

// 2. Lifecycle & Authentication
window.onload = () => { 
    setTimeout(() => { document.getElementById('splash').style.opacity = '0'; 
    setTimeout(()=> document.getElementById('splash').style.display='none', 500); }, 2000); 
};

auth.onAuthStateChanged(u => {
    const overlay = document.getElementById('login-overlay');
    if(u) {
        overlay.style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { 
                uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, 
                inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", 
                city: d.city || "", skills: d.skills || "", fcmToken: d.fcmToken || ""
            };
            bootApp();
        });
    } else { overlay.style.display = "flex"; }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

// 3. Application Bootstrapper (30 Features Engine)
function bootApp() {
    updateUI(); loadFeed(); loadLibrary(); loadCircle(); 
    listenNotifs(); checkMemories(); autoGroupAlumni(); setupFCM();
}

function updateUI() {
    if(!user) return;
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

// 4. Push Notifications (VAPID)
function setupFCM() {
    const VAPID_KEY = 'BNppuFKd12JLfoyzxiLusI7RKlRZn65W9v4OnTul3hi2JkFJjUrrzNPml6cHaCxHG-fhgCj6cssnA8YExKGFPJM';
    messaging.getToken({ vapidKey: VAPID_KEY }).then(t => {
        if(t) db.ref(`users/${user.uid}`).update({ fcmToken: t });
    }).catch(e => console.log("FCM Locked", e));

    messaging.onMessage(p => { 
        new Notification(p.notification.title, { body: p.notification.body }); 
    });
}

// 5. Advanced Posting (Text + Image Base64)
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    if(!msg && !file) return;

    let post = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now() };
    if(file) post.media = await toBase64(file);
    
    db.ref('posts').push(post);
    document.getElementById('msgInput').value = "";
    document.getElementById('f-post').value = "";
}

function loadFeed() {
    db.ref('posts').limitToLast(30).on('value', snap => {
        const cont = document.getElementById('feed-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            cont.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.userPhoto}" style="width:30px; border-radius:50%;">
                        <div><div style="font-weight:600; font-size:13px;">${p.userName}</div>
                        <div style="font-size:9px; color:#999;">${new Date(p.time).toLocaleTimeString()}</div></div>
                    </div>
                    <p style="margin:0; font-size:14px; color:#444;">${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:12px; margin-top:10px; max-height:300px; object-fit:cover;">` : ""}
                </div>` + cont.innerHTML;
        });
    });
}

// 6. Global Search Logic (4 Parameters)
function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    const year = document.getElementById('s-year').value;
    const uClass = document.getElementById('s-class').value.toLowerCase();
    const city = document.getElementById('s-city').value.toLowerCase();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(u.inst.toLowerCase().includes(inst) && (!year || u.year == year) && 
               u.uClass.toLowerCase().includes(uClass) && u.city.toLowerCase().includes(city)) {
                res.innerHTML += `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <div><b>${u.name}</b><br><small>${u.inst} | ${u.city}</small></div>
                        <button onclick="sendReq('${c.key}')" class="btn" style="width:80px; padding:6px; font-size:11px;">Connect</button>
                    </div>`;
            }
        });
        if(res.innerHTML === "") res.innerHTML = "<center>No classmates found</center>";
    });
}

// 7. Automatic Alumni Grouping
function autoGroupAlumni() {
    if(!user.inst || !user.year) return;
    const gid = `${user.inst}_${user.year}_${user.uClass}_${user.city}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    db.ref(`groups/${gid}/info`).set({ name: `${user.inst} - ${user.year}`, id: gid });
    db.ref(`groups/${gid}/members/${user.uid}`).set({ name: user.name, photo: user.photo });
    
    db.ref('groups').on('value', snap => {
        const cont = document.getElementById('auto-groups'); cont.innerHTML = "";
        snap.forEach(s => {
            const g = s.val();
            if(g.members && g.members[user.uid]) {
                cont.innerHTML += `<div class="card" style="background:#f7fafc; display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-university" style="color:var(--primary);"></i> <b>${g.info.name}</b>
                </div>`;
            }
        });
    });
}

// 8. Real-time Private Chat
function openPrivateChat(tid, tname) {
    currentChatId = user.uid < tid ? user.uid + "_" + tid : tid + "_" + user.uid;
    document.getElementById('chat-t-name').innerText = tname;
    document.getElementById('chat-window').style.display = "flex";
    db.ref(`chats/${currentChatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            cont.innerHTML += `<div class="msg ${m.sender === user.uid ? 'sent' : 'received'}">${m.text}</div>`;
        });
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

// 9. Digital Library (Alumni Vault)
async function uploadToLibrary() {
    const title = document.getElementById('lib-title').value;
    const file = document.getElementById('f-lib').files[0];
    if(!title || !file) return alert("Enter title & select file");
    const b64 = await toBase64(file);
    db.ref('library').push({ title, file: b64, uploader: user.name, time: Date.now() });
    alert("Resource shared with alumni!");
}

function loadLibrary() {
    db.ref('library').limitToLast(10).on('value', snap => {
        const list = document.getElementById('library-list'); list.innerHTML = "";
        snap.forEach(s => {
            const d = s.val();
            list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between;" onclick="window.open('${d.file}')">
                <span><i class="fas fa-file-pdf"></i> ${d.title}</span>
                <small style="color:#999;">By ${d.uploader}</small>
            </div>`;
        });
    });
}

// 10. Connections & Sync
function sendReq(tid) { db.ref(`notifications/${tid}`).push({ from: user.name, fromUid: user.uid }); alert("Connection Request Sent!"); }
function listenNotifs() {
    db.ref(`notifications/${user.uid}`).on('value', snap => {
        const cont = document.getElementById('notif-list'); cont.innerHTML = "";
        if(!snap.exists()) cont.innerHTML = "No pending requests";
        snap.forEach(s => {
            const n = s.val();
            cont.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <span><b>${n.from}</b></span>
                <button onclick="acceptReq('${s.key}','${n.fromUid}','${n.from}')" class="btn" style="width:70px; padding:4px; font-size:11px;">Accept</button>
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
        snap.forEach(s => {
            fl.innerHTML += `<div class="card" onclick="openPrivateChat('${s.key}','${s.val().name}')" style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-user-circle" style="color:#cbd5e0; font-size:20px;"></i> ${s.val().name}
            </div>`;
        });
    });
}

// 11. Profile & Memories
function updateProfile() {
    const d = { 
        name: document.getElementById('p-name').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        uClass: document.getElementById('p-class').value, 
        city: document.getElementById('p-city').value, 
        skills: document.getElementById('p-skills').value 
    };
    if(!d.inst || !d.year || !d.uClass || !d.city) return alert("Fill Class Info for Auto-Grouping!");
    db.ref('users/' + user.uid).update(d).then(() => alert("Cloud Sync Complete!"));
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

// Helpers
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        el.classList.add('active-nav');
    }
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
