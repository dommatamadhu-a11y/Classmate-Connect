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

// --- Initialization & Auth ---
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: u.displayName, photo: d.photo || u.photoURL, inst: d.inst||"", uClass: d.uClass||"", year: d.year||"" };
            
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
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-year').value = user.year;
    
    if(user.inst && user.year) {
        document.getElementById('group-tag').style.display = "block";
        document.getElementById('group-text').innerText = `${user.inst} • Batch of ${user.year}`;
    }
}

// --- Home Feed (Images, Likes, Comments) ---
function loadFeed() {
    if(!user.inst || !user.year) return;
    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const container = document.getElementById('post-container'); 
        container.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            const time = new Date(p.time).toLocaleString([], {hour: '2-digit', minute:'2-digit'});
            const likeCount = p.likes ? Object.keys(p.likes).length : 0;
            const hasLiked = p.likes && p.likes[user.uid];
            const delBtn = p.uid === user.uid ? `<i class="fas fa-trash" onclick="deletePost('${s.key}')" style="float:right; color:red; opacity:0.5; cursor:pointer;"></i>` : '';

            container.innerHTML = `
                <div class="card glass active">
                    ${delBtn}
                    <div class="post-header">
                        <img src="${p.userPhoto}" width="42" height="42" style="border-radius:12px; object-fit:cover;">
                        <div class="post-info"><b>${p.userName}</b><small>${time}</small></div>
                    </div>
                    <p style="font-size:14px; margin:10px 0;">${p.msg}</p>
                    ${p.img ? `<img src="${p.img}" class="post-img">` : ''}
                    <div class="post-actions">
                        <div class="action-btn" onclick="likePost('${s.key}')"><i class="fa${hasLiked?'s':'r'} fa-heart" style="${hasLiked?'color:var(--primary)':''}"></i> ${likeCount}</div>
                        <div class="action-btn" onclick="toggleComments('${s.key}')"><i class="far fa-comment"></i> Discussion</div>
                    </div>
                    <div id="comments-${s.key}" class="comment-box">
                        <div id="list-${s.key}"></div>
                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <input type="text" id="input-${s.key}" placeholder="Reply..." style="margin-bottom:0; font-size:12px;">
                            <button onclick="addComment('${s.key}')" class="btn-primary" style="width:60px; padding:5px;">Add</button>
                        </div>
                    </div>
                </div>` + container.innerHTML;
            loadComments(s.key);
        });
    });
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value.trim();
    if(!msg) return notify("Type a message first!");
    if(!user.inst || !user.year) return notify("Complete profile in Settings!");
    
    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    let imgData = "";
    const f = document.getElementById('feedPhoto').files[0];
    if(f) { 
        const r = new FileReader(); 
        imgData = await new Promise(res => { r.onload = e => res(e.target.result); r.readAsDataURL(f); }); 
    }
    
    db.ref('posts').push({ uid: user.uid, userName: user.name, userPhoto: user.photo, msg, img: imgData, groupKey: gKey, time: Date.now() });
    document.getElementById('msgInput').value = ""; document.getElementById('feedPhoto').value = "";
    notify("Posted to your batch!");
}

function likePost(id) { db.ref(`posts/${id}/likes/${user.uid}`).set(true); }
function toggleComments(id) { const b = document.getElementById(`comments-${id}`); b.style.display = b.style.display === 'block' ? 'none' : 'block'; }
function addComment(pid) {
    const i = document.getElementById(`input-${pid}`); if(!i.value) return;
    db.ref(`posts/${pid}/comments`).push({ name: user.name, text: i.value }); i.value = "";
}
function loadComments(pid) {
    db.ref(`posts/${pid}/comments`).on('value', snap => {
        const l = document.getElementById(`list-${pid}`); if(!l) return; l.innerHTML = "";
        snap.forEach(s => { l.innerHTML += `<div style="font-size:12px; margin-bottom:5px;"><b>${s.val().name}:</b> ${s.val().text}</div>`; });
    });
}

// --- Chat with Deletion ---
function openChat(uid, name) {
    activeChatUid = uid; document.getElementById('chat-user').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid + '_' + uid : uid + '_' + user.uid;
    
    db.ref('chats/' + cid).on('value', snap => {
        const c = document.getElementById('chat-msgs'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            const del = isMine ? `<i class="fas fa-trash-alt" style="font-size:10px; margin-left:8px; opacity:0.3; cursor:pointer;" onclick="deleteMsg('${cid}', '${s.key}')"></i>` : '';
            c.innerHTML += `<div class="msg-bubble ${isMine ? 'mine':'theirs'}">${m.text} ${del}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function sendMsg() {
    const v = document.getElementById('chatInput').value.trim(); if(!v) return;
    const cid = user.uid < activeChatUid ? user.uid + '_' + activeChatUid : activeChatUid + '_' + user.uid;
    db.ref('chats/' + cid).push({ sender: user.uid, text: v, time: Date.now() });
    db.ref(`notifications/${activeChatUid}`).push({ type: 'msg', fromName: user.name, text: v });
    document.getElementById('chatInput').value = "";
}

function deleteMsg(cid, mid) { if(confirm("Delete message?")) db.ref(`chats/${cid}/${mid}`).remove(); }

// --- Networking & Notifications ---
function search() {
    const sInst = document.getElementById('s-inst').value.toUpperCase().trim();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(!sInst || (u.inst && u.inst.toUpperCase().includes(sInst))) {
                res.innerHTML += `<div class="card glass" style="display:flex; justify-content:space-between; align-items:center; padding:15px;">
                    <span><b>${u.name}</b><br><small>${u.inst || 'Global User'}</small></span>
                    <button onclick="sendReq('${c.key}')" class="btn-primary" style="width:auto; padding:6px 15px; font-size:12px;">Connect</button>
                </div>`;
            }
        });
    });
}

function sendReq(toUid) { db.ref(`notifications/${toUid}`).push({ type: 'req', fromName: user.name, fromUid: user.uid }); notify("Request sent!"); }

function loadFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('friends-list'); list.innerHTML = "";
        snap.forEach(s => {
            db.ref('users/' + s.key).once('value', usnap => {
                const u = usnap.val();
                db.ref('status/' + s.key).on('value', st => {
                    const status = st.val()?.state === 'online' ? 'online' : 'offline';
                    list.innerHTML += `<div class="card glass" onclick="openChat('${s.key}', '${u.name}')" style="cursor:pointer; display:flex; align-items:center; padding:15px;">
                        <span class="status-dot ${status}"></span><b>${u.name}</b><i class="fas fa-comment-alt" style="margin-left:auto; color:var(--primary)"></i>
                    </div>`;
                });
            });
        });
    });
}

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const l = document.getElementById('notif-list'); l.innerHTML = "";
        const b = document.getElementById('notif-badge');
        if(snap.exists()) {
            b.innerText = snap.numChildren(); b.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                if(n.type === 'req') l.innerHTML += `<div class="card glass"><b>${n.fromName}</b> wants to connect. <button onclick="acceptReq('${n.fromUid}', '${s.key}')" class="btn-primary" style="margin-top:10px;">Accept</button></div>`;
                else l.innerHTML += `<div class="card glass"><b>${n.fromName}:</b> ${n.text}</div>`;
            });
        } else { b.style.display = "none"; }
    });
}

function acceptReq(fid, nid) {
    db.ref(`friends/${user.uid}/${fid}`).set(true); db.ref(`friends/${fid}/${user.uid}`).set(true);
    db.ref(`notifications/${user.uid}/${nid}`).remove(); notify("Connected!");
}

// --- Themes & Profile ---
function setTheme(c) {
    document.documentElement.style.setProperty('--primary', c);
    document.documentElement.style.setProperty('--primary-light', c + '15');
    localStorage.setItem('userTheme', c);
}

function saveProfile() {
    const inst = document.getElementById('p-inst').value; const year = document.getElementById('p-year').value;
    if(!inst || !year) return notify("Institution and Year are required!");
    db.ref('users/' + user.uid).update({ inst, uClass: document.getElementById('p-class').value, year }).then(() => notify("Profile Updated!"));
}

function uploadProfilePic() {
    const f = document.getElementById('p-upload').files[0];
    if(f) { const r = new FileReader(); r.onload = e => db.ref('users/'+user.uid).update({ photo: e.target.result }); r.readAsDataURL(f); }
}

function notify(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function deletePost(id) { if(confirm("Delete post?")) db.ref('posts/'+id).remove(); }
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

// Load saved theme
const st = localStorage.getItem('userTheme'); if(st) setTheme(st);
