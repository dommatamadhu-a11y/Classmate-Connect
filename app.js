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
let pollActive = false;
let currentChatFriendId = null;
let mediaRecorder;
let audioChunks = [];

// Dark Mode Persistence
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

// Auth Observer
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
                city: d.city || "", 
                privacy: d.privacy || false 
            };
            updateUI(); loadFeed(); loadStories(); listenNotifs(); loadFriends();
            db.ref('users/' + u.uid).update({ status: 'online' });
        });
        db.ref('users/' + u.uid + '/status').onDisconnect().set('offline');
    } else { 
        document.getElementById('login-overlay').style.display = "flex"; 
    }
});

// Sync Profile UI - Ensuring values are correctly set
function updateUI() {
    document.getElementById('h-img').src = user.photo || 'https://via.placeholder.com/35';
    document.getElementById('p-img').src = user.photo || 'https://via.placeholder.com/80';
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-name-input').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-hide-contact').checked = user.privacy;
}

// Save Profile Logic
function saveProfile() {
    const nameVal = document.getElementById('p-name-input').value.trim();
    if(!nameVal) { alert("Name is required!"); return; }

    const d = { 
        name: nameVal, 
        inst: document.getElementById('p-inst').value.trim(), 
        year: document.getElementById('p-year').value.trim(), 
        uClass: document.getElementById('p-class').value.trim(), 
        city: document.getElementById('p-city').value.trim(), 
        privacy: document.getElementById('p-hide-contact').checked 
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Saved!"));
}

// Search Logic (4 boxes only)
function search() {
    const inst = document.getElementById('s-inst').value.toLowerCase().trim();
    const year = document.getElementById('s-year').value.trim();
    const ucl = document.getElementById('s-class').value.toLowerCase().trim();
    const city = document.getElementById('s-city').value.toLowerCase().trim();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        let found = false;
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid || u.privacy) return;
            let matches = true;
            if(inst && (!u.inst || !u.inst.toLowerCase().includes(inst))) matches = false;
            if(year && u.year != year) matches = false;
            if(ucl && (!u.uClass || !u.uClass.toLowerCase().includes(ucl))) matches = false;
            if(city && (!u.city || !u.city.toLowerCase().includes(city))) matches = false;
            
            if(matches) {
                found = true;
                res.innerHTML += `
                <div class='card' style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst} | ${u.uClass}</small></div>
                    <button onclick="sendReq('${c.key}')" class="btn-primary" style="width:auto; margin-bottom:0; padding:5px 10px;">Connect</button>
                </div>`;
            }
        });
        if(!found) res.innerHTML = "<p style='text-align:center;'>No classmates found.</p>";
    });
}

// Post & Feed Logic
function togglePoll() {
    pollActive = !pollActive;
    document.getElementById('poll-inputs').style.display = pollActive ? 'block' : 'none';
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    const groupKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), groupKey: groupKey, likesCount: 0 };
    if(pollActive) postData.poll = { q: document.getElementById('p-q').value, o1: document.getElementById('p-1').value, o2: document.getElementById('p-2').value, v1: 0, v2: 0 };
    if(file) postData.media = await toBase64(file);
    if(msg || file || (pollActive && postData.poll.q)) {
        db.ref('posts').push(postData);
        document.getElementById('msgInput').value = "";
        document.getElementById('poll-inputs').style.display = "none";
        pollActive = false;
    }
}

function loadFeed() {
    const groupKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    db.ref('posts').orderByChild('groupKey').equalTo(groupKey).on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            let pollHtml = p.poll ? `<div class='card'><b>${p.poll.q}</b><br><button onclick="vote('${pid}','v1')">${p.poll.o1}(${p.poll.v1})</button><button onclick="vote('${pid}','v2')">${p.poll.o2}(${p.poll.v2})</button></div>` : "";
            cont.innerHTML = `<div class='card'><b>${p.userName}</b><p>${p.msg}</p>${p.media ? `<img src="${p.media}" class="post-img">` : ""}${pollHtml}<span onclick="like('${pid}')" style="color:var(--primary); cursor:pointer;">❤️ ${p.likesCount||0}</span></div>` + cont.innerHTML;
        });
    });
}

function like(pid) { db.ref(`posts/${pid}/likesCount`).transaction(c => (c || 0) + 1); }
function vote(pid, o) { db.ref(`posts/${pid}/poll/${o}`).transaction(v => (v || 0) + 1); }

// Messaging Logic
async function sendMediaMessage() {
    const f = document.getElementById('chat-file').files[0]; if(!f || !currentChatFriendId) return;
    const b = await toBase64(f); pushMessage({ sender: user.uid, media: b });
}

function sendMessage() {
    const t = document.getElementById('chatInput').value; if(!t || !currentChatFriendId) return;
    pushMessage({ sender: user.uid, text: t }); document.getElementById('chatInput').value = "";
}

function pushMessage(o) {
    const fid = currentChatFriendId; const cid = user.uid < fid ? user.uid+"_"+fid : fid+"_"+user.uid;
    db.ref(`chats/${cid}`).push({...o, time: Date.now()});
}

function loadMessages(fid) {
    const cid = user.uid < fid ? user.uid+"_"+fid : fid+"_"+user.uid;
    db.ref(`chats/${cid}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            let del = m.sender === user.uid ? `<span class="delete-btn" style="color:red; font-size:10px; cursor:pointer;" onclick="deleteMsg('${cid}', '${s.key}')">Delete</span>` : "";
            let con = m.text ? m.text : (m.media ? `<img src="${m.media}" class="chat-media">` : `<audio controls src="${m.audio}" style="width:140px;"></audio>`);
            cont.innerHTML += `<div class="${cls}">${del}${con}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}
function deleteMsg(c, m) { if(confirm("Delete?")) db.ref(`chats/${c}/${m}`).remove(); }

function openChat(f, n) { currentChatFriendId = f; document.getElementById('chat-friend-name').innerText = n; show('chat-window'); loadMessages(f); }

// Friends & Notifications
function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => {
            db.ref('users/' + s.key + '/status').on('value', st => {
                const dot = st.val()==='online'?'<span class="online-dot"></span>':'<span class="offline-dot"></span>';
                fl.innerHTML += `<div class='card'>${dot} <b>${s.val().name}</b> <button onclick="openChat('${s.key}','${s.val().name}')" class="btn-primary" style="width:auto; margin-bottom:0; float:right;">Chat</button></div>`;
            });
        });
    });
}

function sendReq(t) { db.ref(`notifications/${t}`).push({ from: user.name, fromUid: user.uid }); alert("Sent!"); }
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const b = document.getElementById('notif-badge'); const l = document.getElementById('notif-list'); l.innerHTML = "";
        if(snap.exists()) { b.innerText = snap.numChildren(); b.style.display="block"; snap.forEach(s => {
            l.innerHTML += `<div class='card'>${s.val().from} <button onclick="acceptReq('${s.key}','${s.val().fromUid}','${s.val().from}')">Accept</button></div>`;
        }); } else b.style.display="none";
    });
}
function acceptReq(k, f, n) { db.ref(`friends/${user.uid}/${f}`).set({name: n}); db.ref(`friends/${f}/${user.uid}`).set({name: user.name}); db.ref(`notifications/${user.uid}/${k}`).remove(); }

// Stories
function loadStories() {
    db.ref('stories').on('value', snap => {
        const l = document.getElementById('story-list'); l.innerHTML = `<div class="story-circle" onclick="addStory()" style="line-height:60px; text-align:center; background:#eee; cursor:pointer;">+</div>`;
        snap.forEach(s => { l.innerHTML += `<div class="story-circle"><img src="${s.val().content}"></div>`; });
    });
}
async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.onchange = async e => {
        const b = await toBase64(e.target.files[0]); db.ref('stories').push({ uid: user.uid, content: b });
    }; i.click();
}

// Utilities
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function blobToBase64(b) { return new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(b); }); }
async function startRecording() { audioChunks = []; const s = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaRecorder = new MediaRecorder(s); mediaRecorder.ondataavailable = e => audioChunks.push(e.data); mediaRecorder.onstop = async () => { const b = await blobToBase64(new Blob(audioChunks)); pushMessage({ sender: user.uid, audio: b }); }; mediaRecorder.start(); }
function stopRecording() { if(mediaRecorder) mediaRecorder.stop(); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { db.ref('users/' + user.uid).update({ status: 'offline' }); auth.signOut().then(() => location.reload()); }
function shareWhatsApp() { window.open(`https://api.whatsapp.com/send?text=Join%20me%20on%20Classmate%20Connect!`, '_blank'); }
function askAI() { /* AI Logic here */ }
