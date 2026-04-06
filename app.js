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

let user = null;
let blockedList = [];

const quotes = [
    "Education is the movement from darkness to light.",
    "The roots of education are bitter, but the fruit is sweet.",
    "Learning is a treasure that will follow its owner everywhere."
];
document.getElementById('daily-quote').innerText = quotes[Math.floor(Math.random() * quotes.length)];

// Auth State
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('blocks/' + u.uid).on('value', snap => {
            blockedList = snap.val() ? Object.keys(snap.val()) : [];
            db.ref('users/' + u.uid).on('value', s => {
                const d = s.val() || {};
                user = { uid: u.uid, name: u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "" };
                syncProfile();
                loadFeed();
                loadStories();
                listenNotifs();
            });
        });
    } else {
        document.getElementById('login-overlay').style.display = "flex";
    }
});

function syncProfile() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
}

function saveProfile() {
    const data = {
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        uClass: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value
    };
    db.ref('users/' + user.uid).update(data).then(() => notify("Profile Updated Successfully!"));
}

// Post Handling
async function handlePost() {
    const msg = document.getElementById('msgInput').value.trim();
    const isPoll = document.getElementById('poll-creator').style.display === 'block';
    let media = ""; let mType = "text";

    const fImg = document.getElementById('f-img').files[0];
    const fPdf = document.getElementById('f-pdf').files[0];

    if(fImg) { media = await toBase64(fImg); mType = "image"; }
    else if(fPdf) { media = await toBase64(fPdf); mType = "pdf"; }

    if(!msg && !media && !isPoll) return;

    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    const postObj = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, media, mType, time: Date.now(), groupKey: gKey };

    if(isPoll) {
        postObj.poll = { 
            q: document.getElementById('poll-q').value, 
            o1: { t: document.getElementById('poll-o1').value, v: 0 }, 
            o2: { t: document.getElementById('poll-o2').value, v: 0 } 
        };
    }

    db.ref('posts').push(postObj);
    resetPostUI();
    notify("Posted to Class Feed!");
}

function loadFeed() {
    if(!user.inst) return;
    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); if(blockedList.includes(p.uid)) return;
            let mediaHTML = p.mType === 'image' ? `<img src="${p.media}" class="post-img">` : (p.mType === 'pdf' ? `<a href="${p.media}" download style="display:block; margin-top:10px; color:var(--primary);"><i class="fas fa-file-pdf"></i> Download PDF</a>` : "");
            let pollHTML = p.poll ? `<div class="poll-box"><b>${p.poll.q}</b><div class="poll-opt" onclick="vote('${s.key}', 'o1')">${p.poll.o1.t} (${p.poll.o1.v})</div><div class="poll-opt" onclick="vote('${s.key}', 'o2')">${p.poll.o2.t} (${p.poll.o2.v})</div></div>` : "";
            
            const btn = p.uid === user.uid ? `<i class="fas fa-trash" onclick="db.ref('posts/${s.key}').remove()"></i>` : `<i class="fas fa-flag" onclick="report('${s.key}')"></i> <i class="fas fa-user-slash" onclick="block('${p.uid}')" style="margin-left:10px;"></i>`;

            cont.innerHTML = `<div class="card glass">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="display:flex; align-items:center;"><img src="${p.userPhoto}" width="30" height="30" style="border-radius:50%; margin-right:8px;"><b>${p.userName}</b></div>
                    <div style="opacity:0.3; cursor:pointer;">${btn}</div>
                </div>
                <p>${p.msg}</p>${mediaHTML}${pollHTML}
            </div>` + cont.innerHTML;
        });
    });
}

// Search Logic
function search() {
    const inst = document.getElementById('s-inst').value.toUpperCase().trim();
    const year = document.getElementById('s-year').value;
    const cl = document.getElementById('s-class').value.toUpperCase().trim();
    const city = document.getElementById('s-city').value.toUpperCase().trim();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        let found = false;
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid || blockedList.includes(c.key)) return;
            let match = true;
            if(inst && (!u.inst || !u.inst.toUpperCase().includes(inst))) match = false;
            if(year && u.year != year) match = false;
            if(cl && (!u.uClass || !u.uClass.toUpperCase().includes(cl))) match = false;
            if(city && (!u.city || !u.city.toUpperCase().includes(city))) match = false;

            if(match && (inst || year || cl || city)) {
                found = true;
                res.innerHTML += `<div class="card glass" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${u.name}</b><br><small>${u.inst || ''} | ${u.uClass || ''}</small></span>
                    <button onclick="sendReq('${c.key}', '${u.name}')" class="btn-primary" style="width:80px; padding:5px;">Connect</button>
                </div>`;
            }
        });
        if(!found) res.innerHTML = "<p style='text-align:center;'>No classmates found.</p>";
    });
}

// Utilities & Social
function toBase64(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function notify(m) { const t = document.getElementById('toast'); t.innerText = m; t.style.display = "block"; setTimeout(() => t.style.display = "none", 3000); }
function show(id, el) { document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); document.getElementById(id).classList.add('active'); el.classList.add('active-nav'); }
function togglePollCreator() { const p = document.getElementById('poll-creator'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
function resetPostUI() { document.getElementById('msgInput').value = ""; document.getElementById('poll-creator').style.display = 'none'; document.getElementById('f-img').value = ""; document.getElementById('f-pdf').value = ""; }
function vote(pid, opt) { db.ref(`posts/${pid}/poll/${opt}/v`).transaction(v => (v || 0) + 1); }
function block(uid) { if(confirm("Block this user?")) db.ref(`blocks/${user.uid}/${uid}`).set(true).then(() => location.reload()); }
function report(pid) { prompt("Reason for reporting?"); notify("Reported to Admin."); }
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function sendReq(uid, name) { db.ref(`notifications/${uid}`).push({ type: 'req', from: user.name, fromUid: user.uid }).then(() => notify("Request Sent!")); }

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const l = document.getElementById('notif-list'); l.innerHTML = "";
        const b = document.getElementById('notif-badge');
        if(snap.exists()) {
            b.innerText = snap.numChildren(); b.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                l.innerHTML += `<div class="card" style="margin:5px 0; background:#f0f0f0;"><b>${n.from}</b> wants to connect.</div>`;
            });
        } else b.style.display = "none";
    });
}

// Stories
function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list'); list.innerHTML = `<div class="story-circle" onclick="addStory()" style="background:#ddd; display:flex; align-items:center; justify-content:center; cursor:pointer;"><i class="fas fa-plus"></i></div>`;
        snap.forEach(s => {
            const d = s.val(); if(blockedList.includes(d.uid)) return;
            list.innerHTML += `<div class="story-circle" onclick="window.open('${d.content}')"><img src="${d.userPhoto}"></div>`;
        });
    });
}
async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.accept='image/*';
    i.onchange = async e => {
        const b64 = await toBase64(e.target.files[0]);
        db.ref('stories').push({ uid: user.uid, userPhoto: user.photo, content: b64, time: Date.now() });
    }; i.click();
}

// AI Helper
function toggleAI() { const w = document.getElementById('ai-window'); w.style.display = w.style.display === 'none' ? 'flex' : 'none'; }
function askAI() {
    const inp = document.getElementById('ai-input'); const box = document.getElementById('ai-msgs');
    if(!inp.value) return;
    box.innerHTML += `<div><b>You:</b> ${inp.value}</div>`;
    let res = "I can help you find classmates or explain how to use this app. Just ask!";
    if(inp.value.toLowerCase().includes("block")) res = "To block someone, click the user-slash icon on their post.";
    setTimeout(() => { box.innerHTML += `<div style="color:var(--primary); margin-top:5px;"><b>AI:</b> ${res}</div>`; box.scrollTop = box.scrollHeight; }, 500);
    inp.value = "";
}
