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
let pollActive = false;

auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst||"", year: d.year||"", uClass: d.uClass||"", city: d.city||"" };
            updateUI(); loadFeed(); loadStories(); listenNotifs(); loadFriends();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-name-input').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
}

function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active-nav');
}

function togglePoll() {
    pollActive = !pollActive;
    document.getElementById('poll-inputs').style.display = pollActive ? 'block' : 'none';
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    const gKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), groupKey: gKey, likesCount: 0 };

    if(pollActive) {
        postData.poll = { q: document.getElementById('p-q').value, o1: document.getElementById('p-1').value, o2: document.getElementById('p-2').value, v1: 0, v2: 0 };
        togglePoll();
        document.getElementById('p-q').value = ""; document.getElementById('p-1').value = ""; document.getElementById('p-2').value = "";
    }
    if(file) postData.media = await toBase64(file);
    if(msg || file || postData.poll) {
        db.ref('posts').push(postData);
        document.getElementById('msgInput').value = "";
        document.getElementById('f-img').value = "";
    }
}

function loadFeed() {
    const gKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            let pollHTML = p.poll ? `<div style="margin:10px 0; padding:10px; border:1px solid #eee; border-radius:10px;"><b>📊 ${p.poll.q}</b><div class="poll-option" onclick="vote('${pid}', 'v1')">${p.poll.o1} <span style="float:right;">${p.poll.v1}</span></div><div class="poll-option" onclick="vote('${pid}', 'v2')">${p.poll.o2} <span style="float:right;">${p.poll.v2}</span></div></div>` : "";
            cont.innerHTML = `<div class="card"><div style="display:flex; align-items:center; margin-bottom:10px;"><img src="${p.userPhoto}" width="30" height="30" style="border-radius:50%; margin-right:10px;"><b>${p.userName}</b></div><p>${p.msg}</p>${p.media ? `<img src="${p.media}" class="post-img">` : ""}${pollHTML}<div style="display:flex; gap:15px; border-top:1px solid #eee; padding-top:8px; margin-top:10px;"><span onclick="likePost('${pid}')" style="cursor:pointer; color:var(--primary); font-size:14px;"><i class="fas fa-heart"></i> ${p.likesCount || 0}</span></div></div>` + cont.innerHTML;
        });
    });
}

function likePost(pid) { db.ref(`posts/${pid}/likesCount`).transaction(c => (c || 0) + 1); }
function vote(pid, opt) { db.ref(`posts/${pid}/poll/${opt}`).transaction(v => (v || 0) + 1); }

function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list');
        list.innerHTML = `<div class="story-circle" onclick="addStory()" style="background:#eee; display:flex; align-items:center; justify-content:center; color:#888; font-size:24px;">+</div>`;
        snap.forEach(s => { list.innerHTML += `<div class="story-circle"><img src="${s.val().userPhoto}"></div>`; });
    });
}

async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.onchange = async e => {
        const b64 = await toBase64(e.target.files[0]);
        db.ref('stories').push({ uid: user.uid, userPhoto: user.photo, content: b64 });
    }; i.click();
}

// SEARCH WITH 4 FILTERS
function search() {
    const inst = document.getElementById('s-inst').value.toUpperCase().trim();
    const year = document.getElementById('s-year').value;
    const clss = document.getElementById('s-class').value.toUpperCase().trim();
    const city = document.getElementById('s-city').value.toUpperCase().trim();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            let match = false;
            if(inst && u.inst?.toUpperCase().includes(inst)) match = true;
            if(year && u.year == year) match = true;
            if(clss && u.uClass?.toUpperCase().includes(clss)) match = true;
            if(city && u.city?.toUpperCase().includes(city)) match = true;

            if(match) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span><b>${u.name}</b><br><small>${u.inst} | ${u.uClass}</small></span><button onclick="sendReq('${c.key}', '${u.name}')" style="background:var(--primary); color:white; border:none; padding:8px; border-radius:5px;"><i class="fas fa-user-plus"></i></button></div>`;
            }
        });
    });
}

function sendReq(tUid, tName) { db.ref(`notifications/${tUid}`).push({ from: user.name, fromUid: user.uid }); alert("Request sent!"); }

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const b = document.getElementById('notif-badge');
        const l = document.getElementById('notif-list'); l.innerHTML = "";
        if(snap.exists()) {
            b.innerText = snap.numChildren(); b.style.display = "block";
            snap.forEach(s => { l.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span><b>${s.val().from}</b> sent a request.</span><button onclick="acceptReq('${s.key}','${s.val().fromUid}','${s.val().from}')" class="btn-primary" style="width:80px;">Accept</button></div>`; });
        } else b.style.display = "none";
    });
}

function acceptReq(nid, fUid, fName) {
    db.ref(`friends/${user.uid}/${fUid}`).set({ name: fName });
    db.ref(`friends/${fUid}/${user.uid}`).set({ name: user.name });
    db.ref(`notifications/${user.uid}/${nid}`).remove();
    alert("Connected!");
}

function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => { fl.innerHTML += `<div class="card"><i class="fas fa-user-circle"></i> ${s.val().name}</div>`; });
    });
}

function saveProfile() {
    const data = { name: document.getElementById('p-name-input').value.trim(), inst: document.getElementById('p-inst').value.trim(), year: document.getElementById('p-year').value.trim(), uClass: document.getElementById('p-class').value.trim(), city: document.getElementById('p-city').value.trim() };
    db.ref('users/' + user.uid).update(data).then(() => alert("Profile details updated successfully!"));
}

function toBase64(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
