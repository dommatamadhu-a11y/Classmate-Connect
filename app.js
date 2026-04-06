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
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { 
                uid: u.uid, 
                name: d.name || u.displayName, 
                photo: u.photoURL, 
                inst: d.inst||"", 
                year: d.year||"", 
                uClass: d.uClass||"", 
                city: d.city||"" 
            };
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

// Home Feed Logic (Post, Likes, Comments)
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    if(!msg && !file) return;
    let media = ""; if(file) media = await toBase64(file);
    const gKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase();
    db.ref('posts').push({
        uid: user.uid, userName: user.name, userPhoto: user.photo,
        msg, media, groupKey: gKey, time: Date.now(), likesCount: 0
    });
    document.getElementById('msgInput').value = "";
    document.getElementById('f-img').value = "";
}

function loadFeed() {
    const gKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase();
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            let commentsHTML = "";
            if(p.comments) Object.values(p.comments).forEach(c => {
                commentsHTML += `<div style="font-size:12px; margin-top:3px;"><b>${c.name}:</b> ${c.text}</div>`;
            });

            cont.innerHTML = `<div class="card">
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                    <img src="${p.userPhoto}" width="30" height="30" style="border-radius:50%; margin-right:10px;">
                    <b>${p.userName}</b>
                </div>
                <p style="font-size:14px;">${p.msg}</p>
                ${p.media ? `<img src="${p.media}" class="post-img">` : ""}
                <div style="display:flex; gap:15px; margin-top:10px; border-top:1px solid #eee; padding-top:8px;">
                    <span onclick="likePost('${pid}')" style="cursor:pointer; color:var(--primary);"><i class="fas fa-heart"></i> ${p.likesCount || 0}</span>
                    <span style="color:#555;"><i class="fas fa-comment"></i> ${p.comments ? Object.keys(p.comments).length : 0}</span>
                </div>
                <div style="margin-top:10px; background:#f9f9f9; padding:8px; border-radius:8px;">
                    ${commentsHTML}
                    <div style="display:flex; margin-top:8px;">
                        <input type="text" id="inp-${pid}" placeholder="Comment..." style="padding:5px; margin:0; font-size:12px;">
                        <button onclick="addComment('${pid}')" style="background:var(--primary); color:white; border:none; padding:0 10px; border-radius:5px; margin-left:5px;">Go</button>
                    </div>
                </div>
            </div>` + cont.innerHTML;
        });
    });
}

function likePost(pid) { db.ref(`posts/${pid}/likesCount`).transaction(c => (c || 0) + 1); }
function addComment(pid) {
    const txt = document.getElementById(`inp-${pid}`).value;
    if(!txt) return;
    db.ref(`posts/${pid}/comments`).push({ name: user.name, text: txt });
    document.getElementById(`inp-${pid}`).value = "";
}

// Global Search & Friends Logic
function search() {
    const inst = document.getElementById('s-inst').value.toUpperCase().trim();
    const yr = document.getElementById('s-year').value;
    const cl = document.getElementById('s-class').value.toUpperCase().trim();
    const ct = document.getElementById('s-city').value.toUpperCase().trim();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if((inst && u.inst?.toUpperCase().includes(inst)) || (yr && u.year == yr) || (cl && u.uClass?.toUpperCase().includes(cl)) || (ct && u.city?.toUpperCase().includes(ct))) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst} | ${u.uClass}</small></div>
                    <button onclick="sendReq('${c.key}', '${u.name}')" style="background:var(--primary); color:white; border:none; padding:8px; border-radius:5px;"><i class="fas fa-user-plus"></i></button>
                </div>`;
            }
        });
    });
}

function sendReq(tUid, tName) {
    db.ref(`notifications/${tUid}`).push({ type: 'friend_req', from: user.name, fromUid: user.uid });
    alert("Request Sent to " + tName);
}

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const l = document.getElementById('notif-list'); l.innerHTML = "";
        const b = document.getElementById('notif-badge');
        if(snap.exists()) {
            b.innerText = snap.numChildren(); b.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                l.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${n.from}</b> sent a request.</span>
                    <button onclick="acceptReq('${s.key}', '${n.fromUid}', '${n.from}')" class="btn-primary" style="width:80px;">Accept</button>
                </div>`;
            });
        } else b.style.display = "none";
    });
}

function acceptReq(nid, fUid, fName) {
    db.ref(`friends/${user.uid}/${fUid}`).set({ name: fName });
    db.ref(`friends/${fUid}/${user.uid}`).set({ name: user.name });
    db.ref(`notifications/${user.uid}/${nid}`).remove();
    alert("You are now connected with " + fName);
}

function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        if(!snap.exists()) fl.innerHTML = "<p style='text-align:center; color:gray;'>No friends yet.</p>";
        snap.forEach(s => {
            fl.innerHTML += `<div class="card"><i class="fas fa-user-circle" style="color:var(--primary);"></i> <b>${s.val().name}</b></div>`;
        });
    });
}

// Profile Save & Stories
function saveProfile() {
    const newName = document.getElementById('p-name-input').value.trim();
    const data = {
        name: newName,
        inst: document.getElementById('p-inst').value.trim(),
        year: document.getElementById('p-year').value.trim(),
        uClass: document.getElementById('p-class').value.trim(),
        city: document.getElementById('p-city').value.trim()
    };
    if(!newName) return alert("Name is required");
    db.ref('users/' + user.uid).update(data).then(() => {
        alert("Profile details updated successfully!");
    });
}

function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list');
        list.innerHTML = `<div class="story-circle" onclick="addStory()" style="background:#eee; display:flex; align-items:center; justify-content:center; color:#888; font-size:20px;">+</div>`;
        snap.forEach(s => { list.innerHTML += `<div class="story-circle"><img src="${s.val().userPhoto}"></div>`; });
    });
}

async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.onchange = async e => {
        const b64 = await toBase64(e.target.files[0]);
        db.ref('stories').push({ uid: user.uid, userPhoto: user.photo, content: b64 });
    }; i.click();
}

function toBase64(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
