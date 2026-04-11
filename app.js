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

// Dark Mode Management
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

// Authentication Observer
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

// Sync Profile UI
function updateUI() {
    document.getElementById('h-img').src = user.photo || 'https://via.placeholder.com/35';
    document.getElementById('p-img').src = user.photo || 'https://via.placeholder.com/90';
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-name-input').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-hide-contact').checked = user.privacy;
}

// Save Profile - Name is Required
function saveProfile() {
    const nameVal = document.getElementById('p-name-input').value.trim();
    if(!nameVal) {
        alert("Name is mandatory for your profile!");
        return;
    }

    const d = { 
        name: nameVal, 
        inst: document.getElementById('p-inst').value.trim(), 
        year: document.getElementById('p-year').value.trim(), 
        uClass: document.getElementById('p-class').value.trim(), 
        city: document.getElementById('p-city').value.trim(), 
        privacy: document.getElementById('p-hide-contact').checked 
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile updated successfully!"));
}

// Search Logic - 4 Boxes only (No Name search)
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
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${u.photo || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; border-radius:50%;">
                        <div><b>${u.name}</b><br><small>${u.inst || 'N/A'} | ${u.uClass || 'N/A'}</small></div>
                    </div>
                    <button onclick="sendReq('${c.key}')" class="btn-primary" style="width:auto; padding:5px 15px;">Connect</button>
                </div>`;
            }
        });
        if(!found) res.innerHTML = "<p style='text-align:center;'>No matching classmates found.</p>";
    });
}

// Feed & Engagement
function togglePoll() {
    pollActive = !pollActive;
    document.getElementById('poll-inputs').style.display = pollActive ? 'block' : 'none';
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    const groupKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), groupKey: groupKey, likesCount: 0 };
    
    if(pollActive) {
        postData.poll = { 
            q: document.getElementById('p-q').value, 
            o1: document.getElementById('p-1').value, 
            o2: document.getElementById('p-2').value, 
            v1: 0, v2: 0 
        };
    }
    
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
            let pollHtml = p.poll ? `
                <div style="border:1px solid #eee; padding:10px; margin-top:10px; border-radius:8px;">
                    <p><b>${p.poll.q}</b></p>
                    <button onclick="vote('${pid}','v1')" class="btn-primary" style="margin-bottom:5px; background:#f8f9fa; color:#333; border:1px solid #ddd;">${p.poll.o1} (${p.poll.v1})</button>
                    <button onclick="vote('${pid}','v2')" class="btn-primary" style="background:#f8f9fa; color:#333; border:1px solid #ddd;">${p.poll.o2} (${p.poll.v2})</button>
                </div>` : "";
            
            cont.innerHTML = `
                <div class='card'>
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.userPhoto}" style="width:35px; height:35px; border-radius:50%;">
                        <b>${p.userName}</b>
                    </div>
                    <p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" class="post-img">` : ""}
                    ${pollHtml}
                    <div style="margin-top:10px; color:var(--primary); cursor:pointer;" onclick="like('${pid}')">
                        <i class="fas fa-heart"></i> ${p.likesCount || 0} Likes
                    </div>
                </div>` + cont.innerHTML;
        });
    });
}

function like(pid) { db.ref(`posts/${pid}/likesCount`).transaction(c => (c || 0) + 1); }
function vote(pid, o) { db.ref(`posts/${pid}/poll/${o}`).transaction(v => (v || 0) + 1); }

// Messaging & Media
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
            let del = m.sender === user.uid ? `<span class="delete-btn" onclick="deleteMsg('${cid}', '${s.key}')"><i class="fas fa-trash"></i></span>` : "";
            let con = m.text ? m.text : (m.media ? `<img src="${m.media}" class="chat-media">` : `<audio controls src="${m.audio}" style="width:140px;"></audio>`);
            cont.innerHTML += `<div class="${cls}">${del}${con}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}
function deleteMsg(c, m) { if(confirm("Delete message?")) db.ref(`chats/${c}/${m}`).remove(); }

function openChat(f, n) { 
    currentChatFriendId = f; 
    document.getElementById('chat-friend-name').innerText = n; 
    show('chat-window'); 
    loadMessages(f); 
}

// Friends List & Requests
function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => {
            db.ref('users/' + s.key + '/status').on('value', st => {
                const statusDot = st.val()==='online'?'<span class="online-dot"></span>':'<span class="offline-dot"></span>';
                fl.innerHTML += `
                <div class='card' style="display:flex; justify-content:space-between; align-items:center;">
                    <div>${statusDot} <b>${s.val().name}</b></div>
                    <button onclick="openChat('${s.key}','${s.val().name}')" class="btn-primary" style="width:auto; padding:5px 15px;">Chat</button>
                </div>`;
            });
        });
    });
}

function sendReq(targetUid) { 
    db.ref(`notifications/${targetUid}`).push({ from: user.name, fromUid: user.uid }); 
    alert("Connect request sent!"); 
}

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const b = document.getElementById('notif-badge'); const l = document.getElementById('notif-list'); l.innerHTML = "";
        if(snap.exists()) { 
            b.innerText = snap.numChildren(); b.style.display="block"; 
            snap.forEach(s => {
                l.innerHTML += `<div class='card'><b>${s.val().from}</b> wants to connect. <button onclick="acceptReq('${s.key}','${s.val().fromUid}','${s.val().from}')" class="btn-primary" style="margin-top:10px;">Accept</button></div>`;
            }); 
        } else b.style.display="none";
    });
}

function acceptReq(key, fUid, fName) { 
    db.ref(`friends/${user.uid}/${fUid}`).set({name: fName}); 
    db.ref(`friends/${fUid}/${user.uid}`).set({name: user.name}); 
    db.ref(`notifications/${user.uid}/${key}`).remove(); 
}

// Stories & Voice Utilities
function loadStories() {
    db.ref('stories').on('value', snap => {
        const l = document.getElementById('story-list'); 
        l.innerHTML = `<div class="story-circle" onclick="addStory()" style="line-height:60px; text-align:center; background:#eee; cursor:pointer;">+</div>`;
        snap.forEach(s => { l.innerHTML += `<div class="story-circle"><img src="${s.val().content}"></div>`; });
    });
}

async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.accept="image/*";
    i.onchange = async e => {
        const b = await toBase64(e.target.files[0]); 
        db.ref('stories').push({ uid: user.uid, content: b, time: Date.now() });
    }; i.click();
}

async function startRecording() {
    audioChunks = []; try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream); 
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => { 
            const b = await blobToBase64(new Blob(audioChunks, { type: 'audio/webm' })); 
            pushMessage({ sender: user.uid, audio: b }); 
        };
        mediaRecorder.start();
    } catch(err) { alert("Mic access denied."); }
}
function stopRecording() { if(mediaRecorder) mediaRecorder.stop(); }

// System Helpers
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        el.classList.add('active-nav');
    }
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function blobToBase64(b) { return new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(b); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { db.ref('users/' + user.uid).update({ status: 'offline' }); auth.signOut().then(() => location.reload()); }
function shareWhatsApp() {
    const text = `Connect with me on Classmate Connect! My Institution: ${user.inst || 'Not set'}. Join here: https://class-connect-b58f0.web.app/`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}
function askAI() {
    const q = document.getElementById('aiInput').value; if(!q) return;
    const cont = document.getElementById('ai-messages'); 
    cont.innerHTML += `<p style="text-align:right; background:#eee; padding:10px; border-radius:8px;"><b>You:</b> ${q}</p>`;
    setTimeout(() => { 
        cont.innerHTML += `<p style="background:var(--primary); color:white; padding:10px; border-radius:8px;"><b>AI Assistant:</b> I am analyzing your query. How else can I help?</p>`; 
        cont.scrollTop = cont.scrollHeight; 
    }, 800);
    document.getElementById('aiInput').value = "";
}
