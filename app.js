// Firebase Configuration
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

// Splash Screen Lifecycle
window.onload = () => { 
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if(splash) splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
    }, 2000); 
};

// Authentication Handler
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
    loadCircle();
    listenNotifs();
    checkMemories();
    autoGroupAlumni();
    initNotifications();
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
    
    if(user.skills) {
        document.getElementById('u-badge').innerText = user.skills.split(',')[0];
        document.getElementById('u-badge').style.display = "block";
    }
}

// Push Notifications
function initNotifications() {
    const vKey = 'BNppuFKd12JLfoyzxiLusI7RKlRZn65W9v4OnTul3hi2JkFJjUrrzNPml6cHaCxHG-fhgCj6cssnA8YExKGFPJM';
    messaging.getToken({ vapidKey: vKey }).then((t) => {
        if (t && user.fcmToken !== t) {
            db.ref(`users/${user.uid}`).update({ fcmToken: t });
        }
    }).catch(e => console.log("FCM Error: ", e));

    messaging.onMessage((payload) => {
        alert(`${payload.notification.title}: ${payload.notification.body}`);
    });
}

// Feed Features
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    if(!msg && !file) return;

    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg: msg, time: Date.now() };
    if(file) postData.media = await toBase64(file);
    
    db.ref('posts').push(postData);
    document.getElementById('msgInput').value = "";
    document.getElementById('f-post').value = "";
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            cont.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.userPhoto}" style="width:30px; height:30px; border-radius:50%;">
                        <b>${p.userName}</b>
                    </div>
                    <p style="margin:0;">${p.msg}</p>
                    ${p.media ? `<img src="${p.media}">` : ""}
                </div>` + cont.innerHTML;
        });
    });
}

// Search Feature (Fixed 4 Boxes)
function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    const year = document.getElementById('s-year').value;
    const uClass = document.getElementById('s-class').value.toLowerCase();
    const city = document.getElementById('s-city').value.toLowerCase();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "";
        snap.forEach(child => {
            const u = child.val();
            if(child.key === user.uid) return;
            
            if(u.inst.toLowerCase().includes(inst) && (!year || u.year == year) && 
               u.uClass.toLowerCase().includes(uClass) && u.city.toLowerCase().includes(city)) {
                res.innerHTML += `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <div><b>${u.name}</b><br><small>${u.inst} (${u.year})</small></div>
                        <button onclick="sendReq('${child.key}')" class="btn-primary" style="width:80px; padding:8px;">Connect</button>
                    </div>`;
            }
        });
    });
}

// Auto Group Creation
function autoGroupAlumni() {
    if(user.inst && user.year && user.uClass && user.city) {
        const gid = `${user.inst}_${user.year}_${user.uClass}_${user.city}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        db.ref(`groups/${gid}/info`).set({ name: `${user.inst} (${user.year})`, id: gid });
        db.ref(`groups/${gid}/members/${user.uid}`).set({ name: user.name, photo: user.photo });
        
        db.ref('groups').on('value', snap => {
            const cont = document.getElementById('auto-groups'); cont.innerHTML = "";
            snap.forEach(s => {
                const g = s.val();
                if(g.members && g.members[user.uid]) {
                    cont.innerHTML += `<div class="card" style="background:#f0f9ff;"><i class="fas fa-users"></i> ${g.info.name}</div>`;
                }
            });
        });
    }
}

// Profile Sync
function updateProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const uClass = document.getElementById('p-class').value.trim();
    const city = document.getElementById('p-city').value.trim();
    const name = document.getElementById('p-name').value.trim();

    if(!inst || !year || !uClass || !city) {
        alert("Institution, Year, Class, and City are mandatory to connect with your class!");
        return;
    }
    
    db.ref('users/' + user.uid).update({ name, inst, year, uClass, city, skills: document.getElementById('p-skills').value })
    .then(() => alert("Profile Synced Successfully!"));
}

// Memories Logic
function checkMemories() {
    db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
        snap.forEach(s => {
            const p = s.val();
            const pD = new Date(p.time);
            const today = new Date();
            if(pD.getDate() == today.getDate() && pD.getMonth() == today.getMonth() && pD.getFullYear() < today.getFullYear()) {
                document.getElementById('mem-banner').style.display = "block";
                document.getElementById('mem-text').innerText = p.msg;
            }
        });
    });
}

// Connection System
function sendReq(tid) { db.ref(`notifications/${tid}`).push({ from: user.name, fromUid: user.uid }); alert("Request Sent!"); }
function listenNotifs() {
    db.ref(`notifications/${user.uid}`).on('value', snap => {
        const cont = document.getElementById('notif-list'); cont.innerHTML = "";
        snap.forEach(s => {
            const n = s.val();
            cont.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span>${n.from} wants to connect</span>
                <button onclick="acceptReq('${s.key}','${n.fromUid}','${n.from}')" class="btn-primary" style="width:70px; padding:5px;">Accept</button>
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
        snap.forEach(s => { cont.innerHTML += `<div class="card"><i class="fas fa-user"></i> ${s.val().name}</div>`; });
    });
}

// Navigation & Utilities
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    el.classList.add('active-nav');
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
