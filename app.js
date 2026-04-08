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

// 1. Core Logic & Theme
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

// 2. Auth State & Online Tracking
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst||"", year: d.year||"", privacy: d.privacy || false };
            updateUI(); loadFeed(); loadStories(); listenNotifs(); loadFriends();
            db.ref('users/' + u.uid).update({ status: 'online' });
        });
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
    document.getElementById('p-hide-contact').checked = user.privacy;
}

// 3. Feed, Media & Polls
function togglePoll() {
    pollActive = !pollActive;
    document.getElementById('poll-inputs').style.display = pollActive ? 'block' : 'none';
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    const gKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), groupKey: gKey, likesCount: 0 };
    if(pollActive) postData.poll = { q: document.getElementById('p-q').value, o1: document.getElementById('p-1').value, o2: document.getElementById('p-2').value, v1: 0, v2: 0 };
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
            let poll = p.poll ? `<div class='card'><b>${p.poll.q}</b><div onclick="vote('${pid}','v1')">${p.poll.o1}(${p.poll.v1})</div><div onclick="vote('${pid}','v2')">${p.poll.o2}(${p.poll.v2})</div></div>` : "";
            cont.innerHTML = `<div class='card'><b>${p.userName}</b><p>${p.msg}</p>${p.media ? `<img src="${p.media}" class="post-img">` : ""}${poll}<span onclick="like('${pid}')">❤️ ${p.likesCount||0}</span></div>` + cont.innerHTML;
        });
    });
}
function like(pid) { db.ref(`posts/${pid}/likesCount`).transaction(c => (c || 0) + 1); }
function vote(pid, o) { db.ref(`posts/${pid}/poll/${o}`).transaction(v => (v || 0) + 1); }

// 4. Chat System with Media & Voice & Delete
async function sendMediaMessage() {
    const file = document.getElementById('chat-file').files[0]; if(!file || !currentChatFriendId) return;
    const b64 = await toBase64(file);
    pushMessage({ sender: user.uid, media: b64, type: 'image' });
}

function sendMessage() {
    const text = document.getElementById('chatInput').value; if(!text || !currentChatFriendId) return;
    pushMessage({ sender: user.uid, text: text });
    document.getElementById('chatInput').value = "";
}

function pushMessage(msgObj) {
    const fid = currentChatFriendId;
    const chatId = user.uid < fid ? user.uid + "_" + fid : fid + "_" + user.uid;
    db.ref(`chats/${chatId}`).push({...msgObj, time: Date.now()});
}

function loadMessages(fid) {
    const chatId = user.uid < fid ? user.uid + "_" + fid : fid + "_" + user.uid;
    db.ref(`chats/${chatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const mid = s.key;
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            let delBtn = m.sender === user.uid ? `<span class="delete-btn" onclick="deleteMsg('${chatId}', '${mid}')">Delete</span>` : "";
            let content = m.text ? m.text : (m.media ? `<img src="${m.media}" class="chat-media">` : `<audio controls src="${m.audio}" style="width:140px;"></audio>`);
            cont.innerHTML += `<div class="${cls}">${delBtn}${content}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}
function deleteMsg(cid, mid) { if(confirm("Delete?")) db.ref(`chats/${cid}/${mid}`).remove(); }

// 5. AI Chatbot
function askAI() {
    const q = document.getElementById('aiInput').value; if(!q) return;
    const cont = document.getElementById('ai-messages');
    cont.innerHTML += `<p style="text-align:right"><b>You:</b> ${q}</p>`;
    // Simple Teacher-Logic Bot (Mock AI)
    setTimeout(() => {
        let ans = "I am your study assistant. For complex math like calculus or geometry, I'm here to help!";
        if(q.toLowerCase().includes("hello")) ans = "Hello teacher! How can I assist you today?";
        cont.innerHTML += `<p style="color:var(--primary)"><b>Bot:</b> ${ans}</p>`;
        cont.scrollTop = cont.scrollHeight;
    }, 1000);
    document.getElementById('aiInput').value = "";
}

// 6. Search, Friends & Online Dots
function search() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid || u.privacy) return;
            if(!inst || u.inst.toLowerCase().includes(inst)) {
                res.innerHTML += `<div class='card'><b>${u.name}</b> <button onclick="sendReq('${c.key}')" class="btn-primary" style="width:auto">Connect</button></div>`;
            }
        });
    });
}

function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => {
            db.ref('users/' + s.key + '/status').on('value', st => {
                const dot = st.val() === 'online' ? '<span class="online-dot"></span>' : '<span class="offline-dot"></span>';
                fl.innerHTML += `<div class='card'>${dot} <b>${s.val().name}</b> <button onclick="openChat('${s.key}','${s.val().name}')" class="btn-primary" style="float:right; width:auto;">Chat</button></div>`;
            });
        });
    });
}
function openChat(f, n) { currentChatFriendId = f; document.getElementById('chat-friend-name').innerText = n; show('chat-window'); loadMessages(f); }

// 7. Stories, Voice & Notifications
function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list'); list.innerHTML = `<div class="story-circle" onclick="addStory()" style="line-height:60px; text-align:center">+</div>`;
        snap.forEach(s => { list.innerHTML += `<div class="story-circle"><img src="${s.val().userPhoto}"></div>`; });
    });
}
async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.onchange = async e => {
        const b = await toBase64(e.target.files[0]); db.ref('stories').push({ uid: user.uid, userPhoto: user.photo, content: b });
    }; i.click();
}
async function startRecording() {
    audioChunks = []; const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
        const b = await blobToBase64(new Blob(audioChunks, { type: 'audio/webm' }));
        pushMessage({ sender: user.uid, audio: b });
    };
    mediaRecorder.start();
}
function stopRecording() { if(mediaRecorder) mediaRecorder.stop(); }

function sendReq(t) { db.ref(`notifications/${t}`).push({ from: user.name, fromUid: user.uid }); alert("Sent!"); }
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const b = document.getElementById('notif-badge'); const list = document.getElementById('notif-list'); list.innerHTML = "";
        if(snap.exists()) { b.innerText = snap.numChildren(); b.style.display="block"; snap.forEach(s => {
            list.innerHTML += `<div class='card'>${s.val().from} wants to connect <button onclick="acceptReq('${s.key}','${s.val().fromUid}','${s.val().from}')">Accept</button></div>`;
        }); } else b.style.display="none";
    });
}
function acceptReq(k, f, n) { db.ref(`friends/${user.uid}/${f}`).set({name: n}); db.ref(`friends/${f}/${user.uid}`).set({name: user.name}); db.ref(`notifications/${user.uid}/${k}`).remove(); }

// 8. General Helpers
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function saveProfile() {
    const d = { name: document.getElementById('p-name-input').value, inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value, privacy: document.getElementById('p-hide-contact').checked };
    db.ref('users/' + user.uid).update(d).then(() => alert("Saved!"));
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function blobToBase64(b) { return new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(b); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { db.ref('users/' + user.uid).update({ status: 'offline' }); auth.signOut().then(() => location.reload()); }
function changeLang(l) { alert("Language switched to: " + l); } // Multi-lang logic integration
