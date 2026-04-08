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
let currentChatFriendId = null;
let mediaRecorder;
let audioChunks = [];

// 1. Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

// 2. Online Status Logic
function setOnlineStatus(status) {
    if(user) {
        db.ref('users/' + user.uid).update({ status: status, lastSeen: Date.now() });
    }
}

// 3. Auth & Translations
const langData = {
    en: { home: "Feed", search: "Search", friends: "Friends", profile: "Profile", find: "Find Classmates", post: "Post", save: "Update Profile", searchBtn: "Search Now", notif: "Notifications" },
    te: { home: "ఫీడ్", search: "వెతకండి", friends: "స్నేహితులు", profile: "ప్రొఫైల్", find: "స్నేహితుల వెతుకులాట", post: "పోస్ట్ చేయి", save: "సేవ్ చేయి", searchBtn: "వెతుకు", notif: "నోటిఫికేషన్స్" }
};

function changeLang(l) {
    for (let key in langData[l]) {
        let el = document.getElementById('nav-' + key) || document.getElementById('txt-' + key) || document.getElementById('btn-' + key);
        if(el) el.innerText = langData[l][key];
    }
}

auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst||"", year: d.year||"", uClass: d.uClass||"", city: d.city||"", privacy: d.privacy || false };
            updateUI(); loadFeed(); loadStories(); listenNotifs(); loadFriends();
            setOnlineStatus('online');
        });
        // Set offline on disconnect
        db.ref('users/' + u.uid + '/status').onDisconnect().set('offline');
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
    document.getElementById('p-hide-contact').checked = user.privacy;
}

// 4. Feed & Polls
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
    }
    if(file) postData.media = await toBase64(file);
    if(msg || file || postData.poll) db.ref('posts').push(postData);
    document.getElementById('msgInput').value = "";
}

function loadFeed() {
    const gKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            let pollHTML = p.poll ? `<div class="card"><b>📊 ${p.poll.q}</b><div class="poll-option" onclick="vote('${pid}', 'v1')">${p.poll.o1} (${p.poll.v1})</div><div class="poll-option" onclick="vote('${pid}', 'v2')">${p.poll.o2} (${p.poll.v2})</div></div>` : "";
            cont.innerHTML = `<div class="card"><b>${p.userName}</b><p>${p.msg}</p>${p.media ? `<img src="${p.media}" class="post-img">` : ""}${pollHTML}<span onclick="likePost('${pid}')"><i class="fas fa-heart"></i> ${p.likesCount || 0}</span></div>` + cont.innerHTML;
        });
    });
}
function likePost(pid) { db.ref(`posts/${pid}/likesCount`).transaction(c => (c || 0) + 1); }
function vote(pid, opt) { db.ref(`posts/${pid}/poll/${opt}`).transaction(v => (v || 0) + 1); }

// 5. Stories
function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list');
        list.innerHTML = `<div class="story-circle" onclick="addStory()" style="background:#eee; text-align:center; line-height:60px;">+</div>`;
        snap.forEach(s => { list.innerHTML += `<div class="story-circle"><img src="${s.val().userPhoto}"></div>`; });
    });
}
async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.onchange = async e => {
        const b64 = await toBase64(e.target.files[0]);
        db.ref('stories').push({ uid: user.uid, userPhoto: user.photo, content: b64 });
    }; i.click();
}

// 6. Search with Privacy Filter
function search() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    const year = document.getElementById('s-year').value;
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid || u.privacy) return; // Skip if privacy is ON
            if((!inst || u.inst.toLowerCase().includes(inst)) && (!year || u.year == year)) {
                res.innerHTML += `<div class="card"><b>${u.name}</b><br><button onclick="sendReq('${c.key}', '${u.name}')" class="btn-primary">Connect</button></div>`;
            }
        });
    });
}

// 7. Chat, Online Status & Delete
function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => {
            const fUid = s.key;
            db.ref('users/' + fUid + '/status').on('value', st => {
                const isOnline = st.val() === 'online' ? '<span class="online-dot"></span>' : '<span class="offline-dot"></span>';
                const elId = 'friend-' + fUid;
                let existing = document.getElementById(elId);
                let html = `<b>${s.val().name}</b> ${isOnline}<button onclick="openChat('${fUid}', '${s.val().name}')" class="btn-primary" style="width:auto; float:right;">Chat</button>`;
                if(existing) existing.innerHTML = html;
                else fl.innerHTML += `<div id="${elId}" class="card">${html}</div>`;
            });
        });
    });
}

function openChat(fid, fname) {
    currentChatFriendId = fid; document.getElementById('chat-friend-name').innerText = fname;
    show('chat-window'); loadMessages(fid);
}

function loadMessages(fid) {
    const chatId = user.uid < fid ? user.uid + "_" + fid : fid + "_" + user.uid;
    db.ref(`chats/${chatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const mid = s.key;
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            let delBtn = m.sender === user.uid ? `<span class="delete-btn" onclick="deleteMsg('${chatId}', '${mid}')">Delete</span>` : "";
            let content = m.text ? m.text : `<audio controls src="${m.audio}" style="width:150px;"></audio>`;
            cont.innerHTML += `<div class="${cls}">${delBtn}${content}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendMessage() {
    const text = document.getElementById('chatInput').value; if(!text || !currentChatFriendId) return;
    const chatId = user.uid < currentChatFriendId ? user.uid + "_" + currentChatFriendId : currentChatFriendId + "_" + user.uid;
    db.ref(`chats/${chatId}`).push({ sender: user.uid, text: text, time: Date.now() });
    document.getElementById('chatInput').value = "";
}
function deleteMsg(chatId, mid) { if(confirm("Delete message?")) db.ref(`chats/${chatId}/${mid}`).remove(); }

// 8. Voice Recording
async function startRecording() {
    audioChunks = []; const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
        const b64 = await blobToBase64(new Blob(audioChunks, { type: 'audio/webm' }));
        const chatId = user.uid < currentChatFriendId ? user.uid + "_" + currentChatFriendId : currentChatFriendId + "_" + user.uid;
        db.ref(`chats/${chatId}`).push({ sender: user.uid, audio: b64, time: Date.now() });
    };
    mediaRecorder.start();
}
function stopRecording() { if(mediaRecorder) mediaRecorder.stop(); }

// 9. Notifications, Profile & Helpers
function sendReq(tUid, tName) { db.ref(`notifications/${tUid}`).push({ from: user.name, fromUid: user.uid }); alert("Sent!"); }
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const b = document.getElementById('notif-badge');
        const list = document.getElementById('notif-list'); list.innerHTML = "";
        if(snap.exists()) {
            b.innerText = snap.numChildren(); b.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                list.innerHTML += `<div class="card">${n.from} wants to connect. <button onclick="acceptReq('${s.key}', '${n.fromUid}', '${n.from}')">Accept</button></div>`;
            });
        } else b.style.display = "none";
    });
}
function acceptReq(nid, fUid, fName) {
    db.ref(`friends/${user.uid}/${fUid}`).set({ name: fName });
    db.ref(`friends/${fUid}/${user.uid}`).set({ name: user.name });
    db.ref(`notifications/${user.uid}/${nid}`).remove();
}
function saveProfile() {
    const d = { 
        name: document.getElementById('p-name-input').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        uClass: document.getElementById('p-class').value, 
        city: document.getElementById('p-city').value,
        privacy: document.getElementById('p-hide-contact').checked
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Saved!"));
}
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    if(el && el.classList) el.classList.add('active-nav');
}
function toBase64(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function blobToBase64(blob) { return new Promise(res => { const r = new FileReader(); r.onloadend = () => res(r.result); r.readAsDataURL(blob); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { setOnlineStatus('offline'); auth.signOut().then(() => location.reload()); }
