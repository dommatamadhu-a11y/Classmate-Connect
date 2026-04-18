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
let currentChatUid = null;

// 1. Auth Listener
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = 'none';
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { 
                uid: u.uid, 
                name: d.name || u.displayName, 
                photo: u.photoURL, 
                inst: d.inst || "", 
                year: d.year || "", 
                class: d.class || "",
                city: d.city || "", 
                skills: d.skills || "" 
            };
            updateUI();
            loadFeed();
            loadFriends();
            loadNotifications();
            autoGroupSync();
        });
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

// 2. Navigation
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el && el.classList.contains('nav-item')) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        el.classList.add('active-nav');
    }
}

// 3. Post Handling (Image & Video Support)
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    const btn = document.getElementById('postBtn');
    
    if(!msg && !file) return;
    
    btn.disabled = true;
    btn.innerText = "Posting...";

    let postData = {
        uid: user.uid,
        userName: user.name,
        userPhoto: user.photo,
        msg: msg,
        time: Date.now()
    };

    if(file) {
        postData.mediaType = file.type.startsWith('video') ? 'video' : 'image';
        postData.media = await toBase64(file);
    }

    db.ref('posts').push(postData).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('f-post').value = "";
        if(document.getElementById('file-name-preview')) 
            document.getElementById('file-name-preview').innerText = "";
        btn.disabled = false;
        btn.innerText = "Post";
    });
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// 4. Feed Rendering
function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        let posts = [];
        snap.forEach(s => { posts.push({ id: s.key, ...s.val() }); });
        posts.reverse().forEach(p => {
            let mediaHTML = "";
            if(p.media) {
                if(p.mediaType === 'video') {
                    mediaHTML = `<video src="${p.media}" class="feed-media" controls></video>`;
                } else {
                    mediaHTML = `<img src="${p.media}" class="feed-media">`;
                }
            }
            cont.innerHTML += `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.userPhoto}" style="width:35px; height:35px; border-radius:50%;">
                        <b>${p.userName}</b>
                    </div>
                    <p>${p.msg}</p>
                    ${mediaHTML}
                </div>`;
        });
    });
}

// 5. Profile & Group Logic
function updateProfile() {
    const d = {
        name: document.getElementById('p-name').value,
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        class: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value,
        skills: document.getElementById('p-skills').value
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile & Groups Synced!"));
}

function autoGroupSync() {
    const groupDiv = document.getElementById('auto-groups');
    if(user.inst && user.year) {
        const gName = `${user.inst}_${user.year}`;
        groupDiv.innerHTML = `<div class="card" onclick="openGroupChat('${gName}')" style="cursor:pointer; background:var(--primary); color:white;">
            <i class="fas fa-users"></i> Join ${user.inst} (${user.year}) Group
        </div>`;
    }
}

// 6. Chat System
function openChat(targetUid, targetName) {
    currentChatUid = targetUid;
    document.getElementById('chat-t-name').innerText = targetName;
    show('chat-window');
    const chatId = user.uid < targetUid ? user.uid + targetUid : targetUid + user.uid;
    db.ref('chats/' + chatId).on('value', snap => {
        const cont = document.getElementById('chat-messages');
        cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            cont.innerHTML += `<div class="${cls}">${m.text}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendChatMessage() {
    const txt = document.getElementById('chatInput').value;
    if(!txt || !currentChatUid) return;
    const chatId = user.uid < currentChatUid ? user.uid + currentChatUid : currentChatUid + user.uid;
    db.ref('chats/' + chatId).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

// 7. Search Classmates
function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(u.inst && u.inst.toLowerCase().includes(inst) && s.key !== user.uid) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${u.name}</b><br><small>${u.inst} (${u.year})</small></span>
                    <button onclick="sendRequest('${s.key}', '${u.name}')" class="btn-primary" style="width:80px; font-size:12px;">Connect</button>
                </div>`;
            }
        });
    });
}

// 8. Notifications & Friends
function sendRequest(targetUid, targetName) {
    db.ref('notifications/' + targetUid).push({ fromUid: user.uid, fromName: user.name, type: 'request' });
    alert("Request Sent!");
}

function loadNotifications() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const cont = document.getElementById('notif-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const n = s.val();
            cont.innerHTML += `<div class="card">
                ${n.fromName} sent a request. 
                <button onclick="acceptRequest('${s.key}', '${n.fromUid}', '${n.fromName}')">Accept</button>
            </div>`;
        });
    });
}

function acceptRequest(key, fUid, fName) {
    db.ref('friends/' + user.uid + '/' + fUid).set({ name: fName });
    db.ref('friends/' + fUid + '/' + user.uid).set({ name: user.name });
    db.ref('notifications/' + user.uid + '/' + key).remove();
}

function loadFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const cont = document.getElementById('friends-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            cont.innerHTML += `<div class="card" onclick="openChat('${s.key}', '${s.val().name}')" style="cursor:pointer;">
                <i class="fas fa-user-circle"></i> ${s.val().name}
            </div>`;
        });
    });
}

// 9. UI & Misc
function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name.split(' ')[0];
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.class;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
}

function togglePoll() {
    const ui = document.getElementById('poll-ui');
    ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
}

function toggleDarkMode() { document.body.classList.toggle('dark'); }

function shareInvite() {
    const msg = encodeURIComponent(`Join me on Classmate Connect Global! Let's reconnect. \nLink: ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`);
}
