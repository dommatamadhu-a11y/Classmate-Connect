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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let user = null;
let pollActive = false;
let currentChatFriendId = null;
let mediaRecorder;
let audioChunks = [];

// --- 1. Multi-Language Support ---
const langData = {
    en: { home: "Feed", search: "Search", friends: "Friends", profile: "Profile", find: "Find Classmates", post: "Post", save: "Update Profile", searchBtn: "Search Now", notif: "Notifications" },
    te: { home: "ఫీడ్", search: "వెతకండి", friends: "స్నేహితులు", profile: "ప్రొఫైల్", find: "స్నేహితుల వెతుకులాట", post: "పోస్ట్ చేయి", save: "సేవ్ చేయి", searchBtn: "వెతుకు", notif: "నోటిఫికేషన్స్" }
};

function changeLang(l) {
    document.getElementById('nav-home').innerText = langData[l].home;
    document.getElementById('nav-search').innerText = langData[l].search;
    document.getElementById('nav-friends-txt').innerText = langData[l].friends;
    document.getElementById('nav-profile').innerText = langData[l].profile;
    document.getElementById('txt-find').innerText = langData[l].find;
    document.getElementById('btn-post').innerText = langData[l].post;
    document.getElementById('btn-save').innerText = langData[l].save;
    document.getElementById('btn-search').innerText = langData[l].searchBtn;
    document.getElementById('txt-notif').innerText = langData[l].notif;
}

// --- 2. Auth State Management ---
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { 
                uid: u.uid, 
                name: d.name || u.displayName, 
                photo: u.photoURL, 
                inst: d.inst || "", 
                year: d.year || "", 
                uClass: d.uClass || "", 
                city: d.city || "" 
            };
            updateUI(); loadFeed(); loadStories(); listenNotifs(); loadFriends();
        });
    } else { 
        document.getElementById('login-overlay').style.display = "flex"; 
    }
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

// --- 3. Home Feed, Polls & Likes ---
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

// --- 4. Stories System ---
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
        db.ref('stories').push({ uid: user.uid, userPhoto: user.photo, content: b64, time: Date.now() });
    }; i.click();
}

// --- 5. Advanced 4-Filter Search ---
function search() {
    const inst = document.getElementById('s-inst').value.toLowerCase().trim();
    const year = document.getElementById('s-year').value.trim();
    const clss = document.getElementById('s-class').value.toLowerCase().trim();
    const city = document.getElementById('s-city').value.toLowerCase().trim();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        let found = false;
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            const mInst = !inst || (u.inst && u.inst.toLowerCase().includes(inst));
            const mYear = !year || (u.year && u.year.toString() === year);
            const mClass = !clss || (u.uClass && u.uClass.toLowerCase().includes(clss));
            const mCity = !city || (u.city && u.city.toLowerCase().includes(city));

            if(mInst && mYear && mClass && mCity) {
                found = true;
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span><b>${u.name}</b><br><small>${u.inst || 'N/A'}</small></span><button onclick="sendReq('${c.key}', '${u.name}')" class="btn-primary" style="width:auto; padding:5px 10px;">Connect</button></div>`;
            }
        });
        if(!found) res.innerHTML = "<p style='text-align:center; color:red;'>No classmates found.</p>";
    });
}

// --- 6. Friends & Real-time Chat ---
function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => {
            const f = s.val();
            fl.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${f.name}</b><button onclick="openChat('${s.key}', '${f.name}')" class="btn-primary" style="width:auto; background:var(--success);">Chat</button></div>`;
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
            const m = s.val(); const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            let content = m.text ? m.text : `<audio controls src="${m.audio}" style="width:180px;"></audio>`;
            cont.innerHTML += `<div class="${cls}">${content}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}
function sendMessage() {
    const text = document.getElementById('chatInput').value.trim(); if(!text || !currentChatFriendId) return;
    const chatId = user.uid < currentChatFriendId ? user.uid + "_" + currentChatFriendId : currentChatFriendId + "_" + user.uid;
    db.ref(`chats/${chatId}`).push({ sender: user.uid, text, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

// --- 7. Voice Messaging System ---
async function startRecording() {
    audioChunks = [];
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const b64 = await blobToBase64(new Blob(audioChunks, { type: 'audio/webm' }));
            const chatId = user.uid < currentChatFriendId ? user.uid + "_" + currentChatFriendId : currentChatFriendId + "_" + user.uid;
            db.ref(`chats/${chatId}`).push({ sender: user.uid, audio: b64, time: Date.now() });
        };
        mediaRecorder.start(); document.getElementById('recordStatus').style.display = "block";
    } catch(e) { alert("Microphone access denied."); }
}
function stopRecording() { if(mediaRecorder) mediaRecorder.stop(); document.getElementById('recordStatus').style.display = "none"; }

// --- 8. Notifications & Requests ---
function sendReq(tUid, tName) { db.ref(`notifications/${tUid}`).push({ from: user.name, fromUid: user.uid }); alert("Request Sent!"); }
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const b = document.getElementById('notif-badge');
        const list = document.getElementById('notif-list'); list.innerHTML = "";
        if(snap.exists()) {
            b.innerText = snap.numChildren(); b.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span><b>${n.from}</b> wants to connect.</span><button onclick="acceptReq('${s.key}', '${n.fromUid}', '${n.from}')" class="btn-primary" style="width:auto; padding:5px 10px;">Accept</button></div>`;
            });
        } else b.style.display = "none";
    });
}
function acceptReq(nid, fUid, fName) {
    db.ref(`friends/${user.uid}/${fUid}`).set({ name: fName });
    db.ref(`friends/${fUid}/${user.uid}`).set({ name: user.name });
    db.ref(`notifications/${user.uid}/${nid}`).remove();
}

// --- 9. Profile & Helper Functions ---
function saveProfile() {
    const d = { name: document.getElementById('p-name-input').value, inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value, uClass: document.getElementById('p-class').value, city: document.getElementById('p-city').value };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Saved!"));
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
function logout() { auth.signOut().then(() => location.reload()); }
