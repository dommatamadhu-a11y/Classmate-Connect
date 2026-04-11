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
let currentChatFriendId = null;

// Dark Mode Toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

// Authentication & Initialization
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "" };
            updateUI(); loadFeed(); listenNotifs(); loadFriends(); listenForRealTimeAlerts();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

// UI Update
function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name-input').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
}

// Real-Time Notification Alerts
function showNotificationAlert(msg) {
    const popup = document.getElementById('notif-popup');
    popup.innerText = msg;
    popup.style.display = 'block';
    setTimeout(() => { popup.style.display = 'none'; }, 3000);
}

function listenForRealTimeAlerts() {
    db.ref('notifications/' + user.uid).on('child_added', snap => {
        showNotificationAlert(`New Connection Request from ${snap.val().from}!`);
    });
    // Message listener for specific users
    db.ref('chats').on('child_added', snap => {
        if (snap.key.includes(user.uid)) {
            db.ref(`chats/${snap.key}`).limitToLast(1).on('child_added', mSnap => {
                if (mSnap.val().sender !== user.uid) showNotificationAlert("New Message Received!");
            });
        }
    });
}

// Post Handling (Likes & Comments included)
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    if(!msg && !file) return;
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), likes: 0 };
    if(file) postData.media = await toBase64(file);
    db.ref('posts').push(postData);
    document.getElementById('msgInput').value = "";
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            let commentsHtml = "";
            if(p.comments) {
                Object.values(p.comments).forEach(c => { commentsHtml += `<div class="comment-item"><b>${c.name}:</b> ${c.text}</div>`; });
            }
            cont.innerHTML = `
                <div class="card">
                    <b>${p.userName}</b><p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" class="post-img">` : ""}
                    <div style="margin-top:10px; display:flex; gap:15px; color:var(--primary); font-weight:600; cursor:pointer;">
                        <span onclick="likePost('${pid}')"><i class="fas fa-heart"></i> ${p.likes || 0}</span>
                        <span><i class="fas fa-comment"></i> Comment</span>
                    </div>
                    <div style="margin-top:10px;">
                        ${commentsHtml}
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <input type="text" id="input-${pid}" placeholder="Write a comment..." style="margin:0; padding:8px;">
                            <button onclick="addComment('${pid}')" class="btn-primary" style="width:60px; margin:0;">Send</button>
                        </div>
                    </div>
                </div>` + cont.innerHTML;
        });
    });
}

function likePost(pid) { db.ref(`posts/${pid}/likes`).transaction(c => (c || 0) + 1); }
function addComment(pid) {
    const t = document.getElementById(`input-${pid}`).value; if(!t) return;
    db.ref(`posts/${pid}/comments`).push({ name: user.name, text: t });
    document.getElementById(`input-${pid}`).value = "";
}

// Chat System (With Delete Option)
function sendMessage() {
    const t = document.getElementById('chatInput').value; if(!t || !currentChatFriendId) return;
    const fid = currentChatFriendId; const cid = user.uid < fid ? user.uid+"_"+fid : fid+"_"+user.uid;
    db.ref(`chats/${cid}`).push({ sender: user.uid, text: t, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

function loadMessages(fid) {
    const cid = user.uid < fid ? user.uid+"_"+fid : fid+"_"+user.uid;
    db.ref(`chats/${cid}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            const del = isMine ? `<i class="fas fa-trash" style="font-size:10px; cursor:pointer; float:right;" onclick="deleteMsg('${cid}','${s.key}')"></i>` : "";
            cont.innerHTML += `<div class="${isMine?'msg-sent':'msg-received'}">${del}${m.text}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}
function deleteMsg(cid, mid) { if(confirm("Delete message?")) db.ref(`chats/${cid}/${mid}`).remove(); }

// Search & Profile
function search() {
    const inst = document.getElementById('s-inst').value.toLowerCase().trim();
    const year = document.getElementById('s-year').value.trim();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if((inst && u.inst.toLowerCase().includes(inst)) || (year && u.year == year)) {
                res.innerHTML += `<div class="card"><b>${u.name}</b><br><small>${u.inst}</small><button onclick="sendReq('${c.key}')" class="btn-primary" style="width:auto; float:right; margin:0;">Connect</button></div>`;
            }
        });
    });
}

function saveProfile() {
    const name = document.getElementById('p-name-input').value.trim();
    if(!name) { alert("Name is required!"); return; }
    const d = { name, inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value, uClass: document.getElementById('p-class').value, city: document.getElementById('p-city').value };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Saved!"));
}

// Helper Functions
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function sendReq(t) { db.ref(`notifications/${t}`).push({ from: user.name, fromUid: user.uid }); alert("Request Sent!"); }
function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => { fl.innerHTML += `<div class="card"><b>${s.val().name}</b><button onclick="openChat('${s.key}','${s.val().name}')" class="btn-primary" style="width:auto; float:right; margin:0;">Chat</button></div>`; });
    });
}
function openChat(f, n) { currentChatFriendId = f; document.getElementById('chat-friend-name').innerText = n; show('chat-window'); loadMessages(f); }
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const b = document.getElementById('notif-badge'); const l = document.getElementById('notif-list'); l.innerHTML = "";
        if(snap.exists()) { b.innerText = snap.numChildren(); b.style.display="block"; snap.forEach(s => {
            l.innerHTML += `<div class="card">${s.val().from} wants to connect. <button onclick="acceptReq('${s.key}','${s.val().fromUid}','${s.val().from}')">Accept</button></div>`;
        }); } else b.style.display="none";
    });
}
function acceptReq(k, f, n) { db.ref(`friends/${user.uid}/${f}`).set({name: n}); db.ref(`friends/${f}/${user.uid}`).set({name: user.name}); db.ref(`notifications/${user.uid}/${k}`).remove(); }
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function shareWhatsApp() { window.open(`https://api.whatsapp.com/send?text=Join%20me%20on%20Classmate%20Connect!`, '_blank'); }
