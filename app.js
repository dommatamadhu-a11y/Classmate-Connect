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

let user = null;

auth.onAuthStateChanged(u => {
    if(u) {
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", city: d.city || "", skills: d.skills || "" };
            initApp();
        });
    } else { /* Redirect to login if needed */ }
});

function initApp() { updateUI(); loadFeed(); loadLibrary(); loadCircle(); listenNotifs(); checkMemories(); autoGroupAlumni(); }

// Navigation
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    if(el) el.classList.add('active-nav');
}

// Post & Media
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    let post = { userName: user.name, msg, time: Date.now(), uid: user.uid };
    if(file) post.media = await toBase64(file);
    db.ref('posts').push(post);
    document.getElementById('msgInput').value = "";
}

// Polls
function createPoll() {
    const q = document.getElementById('pollText').value;
    db.ref('posts').push({ userName: user.name, msg: q, isPoll: true, v1: 0, v2: 0, time: Date.now() });
    document.getElementById('pollText').value = "";
}
function vote(pid, opt) { db.ref(`posts/${pid}/${opt}`).transaction(v => (v || 0) + 1); }

// Load Feed
function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('feed-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            if(p.isPoll) {
                cont.innerHTML = `<div class="card"><b>Poll: ${p.msg}</b><div class="poll-box" onclick="vote('${s.key}','v1')">Agree (${p.v1||0})</div><div class="poll-box" onclick="vote('${s.key}','v2')">Disagree (${p.v2||0})</div></div>` + cont.innerHTML;
            } else {
                cont.innerHTML = `<div class="card"><b>${p.userName}</b><p>${p.msg}</p>${p.media ? `<img src="${p.media}" style="width:100%; border-radius:10px;">`:""}</div>` + cont.innerHTML;
            }
        });
    });
}

// Nostalgia
function checkMemories() {
    db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
        snap.forEach(s => {
            const p = s.val(); const d = new Date(p.time); const n = new Date();
            if(d.getDate()==n.getDate() && d.getMonth()==n.getMonth() && d.getFullYear()<n.getFullYear()) {
                document.getElementById('mem-banner').style.display="block";
                document.getElementById('mem-text').innerText = p.msg;
            }
        });
    });
}

// Search
function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key==user.uid) return;
            if(u.inst && u.inst.toLowerCase().includes(inst)) {
                res.innerHTML += `<div class="card"><b>${u.name}</b><button onclick="sendReq('${c.key}')">Connect</button></div>`;
            }
        });
    });
}

// Circle & Notifications
function sendReq(tid) { db.ref(`notifications/${tid}`).push({ from: user.name, fromUid: user.uid }); }
function listenNotifs() {
    db.ref(`notifications/${user.uid}`).on('value', snap => {
        const cont = document.getElementById('notif-list'); cont.innerHTML = "";
        snap.forEach(s => {
            cont.innerHTML += `<div>${s.val().from} <button onclick="acceptReq('${s.key}','${s.val().fromUid}','${s.val().from}')">Accept</button></div>`;
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
        snap.forEach(s => { cont.innerHTML += `<div class="card">${s.val().name}</div>`; });
    });
}

// Library
function uploadToLibrary() { /* Base64 upload logic */ }
function loadLibrary() { /* Display logic */ }

// AI Career
function openAI() { document.getElementById('ai-container').style.display='flex'; }
function closeAI() { document.getElementById('ai-container').style.display='none'; }
function askAI() {
    const q = document.getElementById('aiInput').value;
    document.getElementById('ai-messages').innerHTML += `<div><b>You:</b> ${q}</div>`;
    setTimeout(() => { document.getElementById('ai-messages').innerHTML += `<div><b>AI:</b> Focus on ${user.skills || 'Mathematics'}!</div>`; }, 800);
    document.getElementById('aiInput').value = "";
}

// Profile & Auto Groups
function updateProfile() {
    const d = { inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value, city: document.getElementById('p-city').value, skills: document.getElementById('p-skills').value };
    db.ref('users/'+user.uid).update(d);
}
function autoGroupAlumni() {
    if(user.inst && user.year) document.getElementById('auto-groups').innerHTML = `<div class="card">Group: ${user.inst} ${user.year}</div>`;
}

// Settings
function toggleTheme() { document.body.classList.toggle('dark-mode'); }
function shareToWhatsApp() { window.open(`https://api.whatsapp.com/send?text=Join Classmate Connect: ${window.location.href}`); }
function updateUI() {
    document.getElementById('h-img').src = user.photo; document.getElementById('h-img').style.display='block';
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function logout() { auth.signOut().then(() => location.reload()); }
