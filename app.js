const firebaseConfig = {
    apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
    authDomain: "class-connect-b58f0.firebaseapp.com",
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "class-connect-b58f0",
    storageBucket: "class-connect-b58f0.firebasestorage.app",
    messagingSenderId: "836461719745",
    appId: "1:836461719745:web:f827862e4db4954626a440",
    measurementId: "G-8QT4VQ5YW5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let user = null;
let activeChatUid = "";

// --- Auth & Presence ---
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: u.displayName, photo: d.photo || u.photoURL, inst: d.inst||"", city: d.city||"", uClass: d.uClass||"", year: d.year||"" };
            db.ref('status/' + u.uid).set({ state: 'online', last: Date.now() });
            db.ref('status/' + u.uid).onDisconnect().set({ state: 'offline', last: Date.now() });
            syncUI(); loadFeed(); loadFriends(); listenNotifs();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function syncUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-year').value = user.year;
    if(user.inst && user.year) {
        document.getElementById('group-tag').style.display = "block";
        document.getElementById('group-text').innerText = `${user.inst} - Batch ${user.year}`;
    }
}

// --- Feed with Likes, Comments, TimeStamps ---
function loadFeed() {
    if(!user.inst || !user.year) return;
    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const container = document.getElementById('post-container'); container.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            const time = new Date(p.time).toLocaleString();
            const likeCount = p.likes ? Object.keys(p.likes).length : 0;
            const del = p.uid === user.uid ? `<i class="fas fa-trash" onclick="deletePost('${s.key}')" style="float:right;color:red;cursor:pointer"></i>` : '';
            
            let postHtml = `
                <div class="card">
                    ${del}
                    <div class="post-header">
                        <img src="${p.userPhoto || ''}" width="40" height="40" style="border-radius:50%">
                        <div class="post-info"><b>${p.userName}</b><small>${time}</small></div>
                    </div>
                    <p>${p.msg}</p>
                    ${p.img ? `<img src="${p.img}" style="width:100%; border-radius:10px; margin-top:5px;">` : ''}
                    <div class="post-actions">
                        <span onclick="likePost('${s.key}')"><i class="fas fa-heart"></i> ${likeCount} Likes</span>
                        <span onclick="toggleComments('${s.key}')"><i class="fas fa-comment"></i> Comments</span>
                    </div>
                    <div id="comments-${s.key}" class="comment-box">
                        <div id="list-${s.key}"></div>
                        <input type="text" id="input-${s.key}" placeholder="Add comment..." onkeydown="if(event.key==='Enter') addComment('${s.key}')">
                    </div>
                </div>`;
            container.innerHTML = postHtml + container.innerHTML;
            loadComments(s.key);
        });
    });
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value.trim();
    if(!msg || !user.inst) return notify("Complete profile first!");
    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    let img = "";
    const f = document.getElementById('feedPhoto').files[0];
    if(f) { const r = new FileReader(); img = await new Promise(res => { r.onload = e => res(e.target.result); r.readAsDataURL(f); }); }
    db.ref('posts').push({ uid: user.uid, userName: user.name, userPhoto: user.photo, msg, img, groupKey: gKey, time: Date.now() });
    document.getElementById('msgInput').value = "";
    notify("Posted!");
}

function deletePost(id) { if(confirm("Delete?")) db.ref('posts/'+id).remove(); }
function likePost(id) { db.ref(`posts/${id}/likes/${user.uid}`).set(true); }
function toggleComments(id) { 
    const box = document.getElementById(`comments-${id}`);
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function addComment(pid) {
    const inp = document.getElementById(`input-${pid}`);
    if(!inp.value) return;
    db.ref(`posts/${pid}/comments`).push({ name: user.name, text: inp.value });
    inp.value = "";
}

function loadComments(pid) {
    db.ref(`posts/${pid}/comments`).on('value', snap => {
        const list = document.getElementById(`list-${pid}`); if(!list) return;
        list.innerHTML = "";
        snap.forEach(s => { list.innerHTML += `<div style="font-size:12px; margin-bottom:5px;"><b>${s.val().name}:</b> ${s.val().text}</div>`; });
    });
}

// --- Search & Connections ---
function search() {
    const sInst = document.getElementById('s-inst').value.toUpperCase().trim();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(!sInst || (u.inst && u.inst.toUpperCase().includes(sInst))) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${u.name}</b><br><small>${u.inst}</small></span>
                    <button onclick="sendReq('${c.key}')" class="btn-blue" style="width:auto; padding:5px 15px;">Connect</button>
                </div>`;
            }
        });
    });
}

function sendReq(toUid) {
    db.ref(`notifications/${toUid}`).push({ type: 'req', fromName: user.name, fromUid: user.uid });
    notify("Request Sent!");
}

function loadFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('friends-list'); list.innerHTML = "";
        snap.forEach(s => {
            db.ref('users/' + s.key).once('value', usnap => {
                const u = usnap.val();
                db.ref('status/' + s.key).on('value', st => {
                    const online = st.val()?.state === 'online' ? 'online' : 'offline';
                    list.innerHTML += `<div class="card" onclick="openChat('${s.key}', '${u.name}')" style="cursor:pointer;">
                        <span class="status-dot ${online}"></span><b>${u.name}</b><i class="fas fa-comment" style="float:right"></i>
                    </div>`;
                });
            });
        });
    });
}

// --- Messaging & Notifications ---
function openChat(uid, name) {
    activeChatUid = uid; document.getElementById('chat-user').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid + '_' + uid : uid + '_' + user.uid;
    db.ref('chats/' + cid).on('value', snap => {
        const c = document.getElementById('chat-msgs'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            c.innerHTML += `<div class="msg-bubble ${m.sender === user.uid ? 'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function sendMsg() {
    const val = document.getElementById('chatInput').value.trim();
    if(!val) return;
    const cid = user.uid < activeChatUid ? user.uid + '_' + activeChatUid : activeChatUid + '_' + user.uid;
    db.ref('chats/' + cid).push({ sender: user.uid, text: val });
    db.ref(`notifications/${activeChatUid}`).push({ type: 'msg', fromName: user.name, text: val });
    document.getElementById('chatInput').value = "";
}

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const list = document.getElementById('notif-list'); list.innerHTML = "";
        const badge = document.getElementById('notif-badge');
        if(snap.exists()) {
            badge.innerText = snap.numChildren(); badge.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                if(n.type === 'req') list.innerHTML += `<div class="card">${n.fromName} sent request <button onclick="acceptReq('${n.fromUid}', '${s.key}')" class="btn-blue" style="margin-top:5px;">Accept</button></div>`;
                else list.innerHTML += `<div class="card"><b>${n.fromName}:</b> ${n.text}</div>`;
            });
        } else { badge.style.display = "none"; }
    });
}

function acceptReq(fid, nid) {
    db.ref(`friends/${user.uid}/${fid}`).set(true); db.ref(`friends/${fid}/${user.uid}`).set(true);
    db.ref(`notifications/${user.uid}/${nid}`).remove(); notify("Connected!");
}

// --- Utils ---
function saveProfile() {
    const d = { inst: document.getElementById('p-inst').value, city: document.getElementById('p-city').value, uClass: document.getElementById('p-class').value, year: document.getElementById('p-year').value };
    db.ref('users/' + user.uid).update(d).then(() => notify("Updated!"));
}
function uploadProfilePic() {
    const f = document.getElementById('p-upload').files[0];
    if(f) { const r = new FileReader(); r.onload = e => db.ref('users/'+user.uid).update({ photo: e.target.result }); r.readAsDataURL(f); }
}
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function notify(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
