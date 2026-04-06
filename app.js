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

// --- Online Status & Auth ---
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: u.displayName, photo: d.photo || u.photoURL, inst: d.inst||"", city: d.city||"", uClass: d.uClass||"", year: d.year||"" };
            
            // Set Online Status
            db.ref('status/' + u.uid).set({ state: 'online', last_changed: Date.now() });
            db.ref('status/' + u.uid).onDisconnect().set({ state: 'offline', last_changed: Date.now() });

            syncUI(); loadGroupFeed(); loadFriends(); listenNotifs();
        });
        requestNotifPermission();
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

    if(user.inst && user.year && user.uClass) {
        document.getElementById('group-info').style.display = "block";
        document.getElementById('group-text').innerText = `${user.inst} (${user.year}) - ${user.uClass}`;
    }
}

// --- Automatic Group Feed ---
function loadGroupFeed() {
    if(!user.inst || !user.year || !user.uClass) return;
    const groupKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    db.ref('posts').orderByChild('groupKey').equalTo(groupKey).on('value', snap => {
        const c = document.getElementById('post-container'); c.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            const del = p.uid === user.uid ? `<i class="fas fa-trash" style="float:right;color:red;" onclick="deletePost('${s.key}')"></i>` : '';
            c.innerHTML = `<div class="card">${del}<b>${p.name}</b><p>${p.msg}</p>${p.img ? `<img src="${p.img}" style="width:100%; border-radius:10px;">`:''}</div>` + c.innerHTML;
        });
    });
}

async function handlePost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!txt || !user.inst) return notify("Please complete profile first!");
    const groupKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    let img = "";
    const f = document.getElementById('feedPhoto').files[0];
    if(f) {
        const r = new FileReader();
        img = await new Promise(res => { r.onload = e => res(e.target.result); r.readAsDataURL(f); });
    }
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, img, groupKey, time: Date.now() });
    document.getElementById('msgInput').value = "";
    notify("Posted to group!");
}

// --- Advanced Search & Personal Chat ---
function search() {
    const sInst = document.getElementById('s-inst').value.toUpperCase().trim();
    const sCity = document.getElementById('s-city').value.toUpperCase().trim();
    db.ref('users').once('value', snap => {
        const r = document.getElementById('search-results'); r.innerHTML = "<h4>Search Results</h4>";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if((!sInst || u.inst.toUpperCase().includes(sInst)) && (!sCity || u.city.toUpperCase().includes(sCity))) {
                r.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${u.name}</b><br><small>${u.inst}</small></span>
                    <button onclick="sendReq('${c.key}')" class="btn-blue" style="width:auto; padding:5px 15px;">Send Request</button>
                </div>`;
            }
        });
    });
}

function sendReq(toUid) {
    db.ref(`notifications/${toUid}`).push({ type: 'req', fromName: user.name, fromUid: user.uid, time: Date.now() });
    notify("Friend Request Sent!");
}

function loadFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('friends-list'); list.innerHTML = "";
        snap.forEach(s => {
            db.ref('users/' + s.key).once('value', usnap => {
                const u = usnap.val();
                db.ref('status/' + s.key).on('value', st => {
                    const status = st.val()?.state === 'online' ? '<span class="status-dot"></span>' : '<span class="offline-dot"></span>';
                    list.innerHTML += `<div class="card" onclick="openChat('${s.key}', '${u.name}')" style="cursor:pointer;">
                        ${status} <b>${u.name}</b> <i class="fas fa-chevron-right" style="float:right;"></i>
                    </div>`;
                });
            });
        });
    });
}

// --- Chatting Logic ---
function openChat(uid, name) {
    activeChatUid = uid;
    document.getElementById('chat-user').innerText = name;
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
    const txt = document.getElementById('chatInput').value.trim();
    if(!txt) return;
    const cid = user.uid < activeChatUid ? user.uid + '_' + activeChatUid : activeChatUid + '_' + user.uid;
    db.ref('chats/' + cid).push({ sender: user.uid, text: txt, time: Date.now() });
    db.ref(`notifications/${activeChatUid}`).push({ type: 'msg', fromName: user.name, text: txt });
    document.getElementById('chatInput').value = "";
}

// --- Notifications ---
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const list = document.getElementById('notif-list'); list.innerHTML = "";
        const badge = document.getElementById('notif-badge');
        if(snap.exists()) {
            badge.innerText = snap.numChildren(); badge.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                if(n.type === 'req') {
                    list.innerHTML += `<div class="card">
                        <b>${n.fromName}</b> sent you a friend request.
                        <button onclick="acceptReq('${n.fromUid}', '${s.key}')" class="btn-blue" style="margin-top:10px;">Accept</button>
                    </div>`;
                } else {
                    list.innerHTML += `<div class="card"><b>${n.fromName}</b>: ${n.text}</div>`;
                }
            });
        } else { badge.style.display = "none"; list.innerHTML = "<p>No new notifications</p>"; }
    });
}

function acceptReq(fid, nid) {
    db.ref(`friends/${user.uid}/${fid}`).set(true);
    db.ref(`friends/${fid}/${user.uid}`).set(true);
    db.ref(`notifications/${user.uid}/${nid}`).remove();
    notify("Request Accepted!");
}

// --- Browser Permissions & Utils ---
function requestNotifPermission() {
    if(Notification.permission === 'default') Notification.requestPermission();
}

function notify(m) {
    const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
    if(Notification.permission === 'granted') new Notification("Classmate Connect", { body: m });
}

function saveProfile() {
    const d = { 
        inst: document.getElementById('p-inst').value, 
        city: document.getElementById('p-city').value, 
        uClass: document.getElementById('p-class').value, 
        year: document.getElementById('p-year').value 
    };
    db.ref('users/' + user.uid).update(d).then(() => notify("Profile Updated!"));
}

function uploadProfilePic() {
    const f = document.getElementById('p-upload').files[0];
    if(f) { const r = new FileReader(); r.onload = e => db.ref('users/'+user.uid).update({ photo: e.target.result }); r.readAsDataURL(f); }
}

function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function login() { const p = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(p); }
function logout() { auth.signOut().then(() => location.reload()); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function deletePost(id) { if(confirm("Delete post?")) db.ref('posts/'+id).remove(); }
