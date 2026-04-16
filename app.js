// 1. Firebase Configuration
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
let currentGroupId = null;
let pollActive = false;

// 2. Splash Screen & Lifecycle
window.onload = () => { 
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if(splash) splash.style.display = 'none';
    }, 2000); 
};

// 3. Auth State Observer
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
    } else { 
        document.getElementById('login-overlay').style.display = "flex"; 
    }
});

function initApp() {
    updateUI(); 
    loadFeed(); 
    loadLibrary(); 
    loadCircle(); 
    listenNotifs(); 
    checkMemories(); 
    autoGroupAlumni(); 
    initNotifications();
}

// 4. Update UI & Badges
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
    
    const badge = document.getElementById('u-badge');
    if(user.skills) {
        badge.innerText = user.skills.split(',')[0];
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

// 5. Custom Push Notifications
function initNotifications() {
    const myVapidKey = 'BNppuFKd12JLfoyzxiLusI7RKlRZn65W9v4OnTul3hi2JkFJjUrrzNPml6cHaCxHG-fhgCj6cssnA8YExKGFPJM';
    messaging.getToken({ vapidKey: myVapidKey }).then((token) => {
        if (token && user.fcmToken !== token) {
            db.ref(`users/${user.uid}`).update({ fcmToken: token });
            console.log("FCM Token Updated.");
        }
    }).catch((err) => console.log("FCM Error:", err));

    messaging.onMessage((payload) => {
        alert(`${payload.notification.title}: ${payload.notification.body}`);
    });
}

// 6. Global Feed & Media
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    if(!msg && !file) return;

    let post = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg: msg, time: Date.now(), likes: 0 };
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
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.userPhoto || 'https://via.placeholder.com/40'}" style="width:35px; height:35px; border-radius:50%;">
                        <b>${p.userName}</b>
                    </div>
                    <p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:12px;">` : ""}
                </div>` + cont.innerHTML;
        });
    });
}

// 7. Search Classmates (Exact 4 Filters)
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
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.city}</small></div>
                    <button onclick="sendReq('${c.key}')" class="btn-primary" style="width:80px;">Connect</button>
                </div>`;
            }
        });
    });
}

// 8. Auto Grouping & Group Chat
function autoGroupAlumni() {
    if(user.inst && user.year && user.uClass && user.city) {
        const gid = `${user.inst}_${user.year}_${user.uClass}_${user.city}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        db.ref(`groups/${gid}/info`).set({ name: `${user.inst} (${user.year}) - ${user.uClass}`, id: gid });
        db.ref(`groups/${gid}/members/${user.uid}`).set({ name: user.name, photo: user.photo });
        loadGroupsList();
    }
}

function loadGroupsList() {
    db.ref('groups').on('value', snap => {
        const cont = document.getElementById('auto-groups'); cont.innerHTML = "";
        snap.forEach(s => {
            const g = s.val();
            if(g.members && g.members[user.uid]) {
                cont.innerHTML += `<div class="card" onclick="openGroupChat('${s.key}', '${g.info.name}')" style="cursor:pointer;"><i class="fas fa-users"></i> ${g.info.name}</div>`;
            }
        });
    });
}

function openGroupChat(gid, gname) {
    currentGroupId = gid;
    document.getElementById('g-chat-name').innerText = gname;
    show('group-chat-window');
    db.ref(`group_messages/${gid}`).on('value', snap => {
        const cont = document.getElementById('group-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            cont.innerHTML += `<div class="${isMine?'msg-sent':'msg-received'}"><small style="display:block; font-size:8px;">${m.senderName}</small>${m.text}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendGroupMessage() {
    const text = document.getElementById('g-chatInput').value;
    if(!text) return;
    db.ref(`group_messages/${currentGroupId}`).push({ sender: user.uid, senderName: user.name, text, time: Date.now() });
    document.getElementById('g-chatInput').value = "";
}

// 9. Digital Library
async function uploadToLibrary() {
    const title = document.getElementById('lib-title').value;
    const file = document.getElementById('f-lib').files[0];
    if(!title || !file) return alert("Title and File required");
    const b64 = await toBase64(file);
    db.ref('library').push({ title, file: b64, uploader: user.name, time: Date.now() });
}

function loadLibrary() {
    db.ref('library').on('value', snap => {
        const cont = document.getElementById('library-list'); cont.innerHTML = "";
        snap.forEach(s => {
            const d = s.val();
            cont.innerHTML += `<div class="lib-item" onclick="downloadFile('${d.file}', '${d.title}')"><i class="fas fa-file-pdf"></i><br><small>${d.title}</small></div>`;
        });
    });
}

// 10. Memories & Circle
function checkMemories() {
    db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
        snap.forEach(s => {
            const p = s.val(); const pD = new Date(p.time); const today = new Date();
            if(pD.getDate()==today.getDate() && pD.getMonth()==today.getMonth() && pD.getFullYear()<today.getFullYear()) {
                document.getElementById('mem-banner').style.display = "block";
                document.getElementById('mem-text').innerText = p.msg;
            }
        });
    });
}

function sendReq(tid) { db.ref(`notifications/${tid}`).push({from:user.name, fromUid:user.uid}); alert("Request Sent!"); }

function listenNotifs() {
    db.ref(`notifications/${user.uid}`).on('value', snap => {
        const l = document.getElementById('notif-list'); l.innerHTML = "";
        snap.forEach(s => {
            const n = s.val();
            l.innerHTML += `<div class="card" style="display:flex; justify-content:space-between;">
                <span>Request from ${n.from}</span>
                <button onclick="acceptReq('${s.key}','${n.fromUid}','${n.from}')" class="btn-primary" style="width:70px;">Accept</button>
            </div>`;
        });
    });
}

function acceptReq(key, fuid, fname) {
    db.ref(`friends/${user.uid}/${fuid}`).set({name:fname});
    db.ref(`friends/${fuid}/${user.uid}`).set({name:user.name});
    db.ref(`notifications/${user.uid}/${key}`).remove();
    alert("Connection Accepted!");
}

function loadCircle() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => {
            fl.innerHTML += `<div class="card" onclick="openPrivateChat('${s.key}','${s.val().name}')"><i class="fas fa-user"></i> ${s.val().name}</div>`;
        });
    });
}

// 11. Profile Update (With Mandatory Alert)
function updateProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const uClass = document.getElementById('p-class').value.trim();
    const city = document.getElementById('p-city').value.trim();
    const name = document.getElementById('p-name').value.trim();

    if(!inst || !year || !uClass || !city) {
        alert("CRITICAL: Please fill Institution Name, Passout Year, Studying Class, and Institution City to join your classmates' group!");
        return;
    }
    db.ref('users/' + user.uid).update({ name, inst, year, uClass, city, skills: document.getElementById('p-skills').value }).then(() => {
        alert("Profile Updated & Synced!");
        autoGroupAlumni();
    });
}

// 12. Navigation & Helpers
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { 
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); 
        el.classList.add('active-nav'); 
    }
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function downloadFile(b, n) { const a = document.createElement('a'); a.href = b; a.download = n; a.click(); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function togglePoll() { pollActive = !pollActive; document.getElementById('poll-ui').style.display = pollActive?'block':'none'; }
function askAI() { alert("Career AI is analyzing your skills..."); }
