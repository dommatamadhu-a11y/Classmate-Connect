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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let user = null;
let activeChatUid = "";

// --- Daily Quotes Logic (English Only) ---
const quotes = [
    "Education is the most powerful weapon which you can use to change the world.",
    "The beautiful thing about learning is that no one can take it away from you.",
    "Your classmates are your first professional network. Keep them close.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The expert in anything was once a beginner.",
    "Your education is a dress rehearsal for a life that is yours to lead.",
    "The best way to predict your future is to create it."
];
const quoteEl = document.getElementById('daily-quote');
if(quoteEl) quoteEl.innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;

// --- Auth State & Initialization ---
auth.onAuthStateChanged(u => {
    if(u) {
        const loginOverlay = document.getElementById('login-overlay');
        if(loginOverlay) loginOverlay.style.display = "none";
        
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { 
                uid: u.uid, 
                name: u.displayName, 
                photo: d.photo || u.photoURL, 
                inst: d.inst || "", 
                uClass: d.uClass || "", 
                year: d.year || "", 
                city: d.city || "" 
            };
            
            // Online Status Tracking
            db.ref('status/' + u.uid).set({ state: 'online', last: Date.now() });
            db.ref('status/' + u.uid).onDisconnect().set({ state: 'offline', last: Date.now() });

            syncUI(); loadFeed(); loadFriends(); listenNotifs(); loadStories();
        });
    } else {
        const loginOverlay = document.getElementById('login-overlay');
        if(loginOverlay) loginOverlay.style.display = "flex";
    }
});

function syncUI() {
    if(!user) return;
    const hImg = document.getElementById('h-img');
    const pImg = document.getElementById('p-img');
    const pName = document.getElementById('p-name');
    
    if(hImg) hImg.src = user.photo;
    if(pImg) pImg.src = user.photo;
    if(pName) pName.innerText = user.name;
    
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-city').value = user.city;
    
    const groupTag = document.getElementById('group-tag');
    if(user.inst && user.year && groupTag) {
        groupTag.style.display = "block";
        document.getElementById('group-text').innerText = `${user.inst} | ${user.uClass} | ${user.year}`;
    }
}

// --- Stories (Instagram Style - 24H Auto Expiry) ---
async function addStory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async e => {
        const file = e.target.files[0];
        const base64 = await toBase64(file);
        db.ref('stories').push({
            uid: user.uid,
            userName: user.name,
            userPhoto: user.photo,
            content: base64,
            expires: Date.now() + (24 * 60 * 60 * 1000) 
        });
        notify("Story Added!");
    };
    input.click();
}

function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list');
        if(!list) return;
        list.innerHTML = `<div class="story-circle" style="border-style:dashed; display:flex; align-items:center; justify-content:center;" onclick="addStory()"><i class="fas fa-plus"></i></div>`;
        const now = Date.now();
        snap.forEach(s => {
            const d = s.val();
            if(d.expires < now) {
                db.ref('stories/' + s.key).remove();
            } else {
                list.innerHTML += `<div class="story-circle" onclick="window.open('${d.content}', '_blank')"><img src="${d.userPhoto}"></div>`;
            }
        });
    });
}

// --- Enhanced Feed (Media & Polls) ---
async function handlePost() {
    const msg = document.getElementById('msgInput').value.trim();
    const isPoll = document.getElementById('poll-creator').style.display === 'block';
    
    let mediaData = "";
    let mediaType = "text";

    const fImg = document.getElementById('f-img').files[0];
    const fVid = document.getElementById('f-vid').files[0];
    const fPdf = document.getElementById('f-pdf').files[0];

    if(fImg) { mediaData = await toBase64(fImg); mediaType = "image"; }
    else if(fVid) { mediaData = await toBase64(fVid); mediaType = "video"; }
    else if(fPdf) { mediaData = await toBase64(fPdf); mediaType = "pdf"; }

    if(!msg && !mediaData && !isPoll) return notify("Please add content!");

    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    const postObj = {
        uid: user.uid, userName: user.name, userPhoto: user.photo,
        msg, media: mediaData, mediaType, time: Date.now(),
        groupKey: gKey
    };

    if(isPoll) {
        postObj.poll = {
            q: document.getElementById('poll-q').value,
            o1: { t: document.getElementById('poll-o1').value, v: 0 },
            o2: { t: document.getElementById('poll-o2').value, v: 0 }
        };
    }

    db.ref('posts').push(postObj);
    resetPostUI();
    notify("Post Shared!");
}

function loadFeed() {
    if(!user.inst || !user.year) return;
    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const container = document.getElementById('post-container');
        if(!container) return;
        container.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            const time = new Date(p.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const hasLiked = p.likes && p.likes[user.uid];
            
            let mediaHTML = "";
            if(p.mediaType === 'image') mediaHTML = `<img src="${p.media}" class="post-img" style="border-radius:15px; margin-top:10px; cursor:pointer;" onclick="window.open('${p.media}', '_blank')">`;
            if(p.mediaType === 'video') mediaHTML = `<video src="${p.media}" controls class="post-img" style="border-radius:15px; margin-top:10px;"></video>`;
            if(p.mediaType === 'pdf') mediaHTML = `<div class="card glass" style="background:rgba(99,102,241,0.1); padding:10px; margin-top:10px;"><a href="${p.media}" download="Classmate_Doc.pdf" style="text-decoration:none; color:var(--primary); font-weight:600;"><i class="fas fa-file-pdf"></i> Download PDF Document</a></div>`;
            
            let pollHTML = "";
            if(p.poll) {
                pollHTML = `
                    <div style="margin-top:15px; border-top:1px solid rgba(0,0,0,0.05); padding-top:10px;">
                        <b style="font-size:13px;">📊 ${p.poll.q}</b>
                        <div class="poll-option" onclick="vote('${s.key}', 'o1')" style="background:rgba(0,0,0,0.03); padding:10px; border-radius:10px; margin-top:5px; cursor:pointer;">
                            <span>${p.poll.o1.t}</span> <span style="float:right; font-weight:bold;">${p.poll.o1.v}</span>
                        </div>
                        <div class="poll-option" onclick="vote('${s.key}', 'o2')" style="background:rgba(0,0,0,0.03); padding:10px; border-radius:10px; margin-top:5px; cursor:pointer;">
                            <span>${p.poll.o2.t}</span> <span style="float:right; font-weight:bold;">${p.poll.o2.v}</span>
                        </div>
                    </div>`;
            }

            const delBtn = p.uid === user.uid ? `<i class="fas fa-trash" onclick="deletePost('${s.key}')" style="float:right; color:red; opacity:0.3; cursor:pointer;"></i>` : '';

            container.innerHTML = `
                <div class="card glass active" style="margin-bottom:20px; padding:15px; border-radius:20px;">
                    ${delBtn}
                    <div class="post-header" style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.userPhoto}" width="40" height="40" style="border-radius:12px; object-fit:cover;">
                        <div class="post-info"><b style="font-size:14px;">${p.userName}</b><br><small style="color:gray; font-size:10px;">${time}</small></div>
                    </div>
                    <p style="font-size:14px; margin:12px 0;">${p.msg}</p>
                    ${mediaHTML}
                    ${pollHTML}
                    <div class="post-actions" style="display:flex; gap:20px; margin-top:15px; color:gray; font-size:13px;">
                        <div onclick="likePost('${s.key}')" style="cursor:pointer;"><i class="fa${hasLiked?'s':'r'} fa-heart" style="${hasLiked?'color:var(--primary)':''}"></i> ${p.likes ? Object.keys(p.likes).length : 0}</div>
                        <div onclick="toggleComments('${s.key}')" style="cursor:pointer;"><i class="far fa-comment"></i> Discussion</div>
                    </div>
                    <div id="comments-${s.key}" style="display:none; margin-top:15px; border-top:1px solid #f0f0f0; padding-top:10px;">
                        <div id="list-${s.key}"></div>
                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <input type="text" id="input-${s.key}" placeholder="Add a reply..." style="padding:8px; flex:1; border-radius:10px; border:1px solid #ddd; font-size:12px;">
                            <button onclick="addComment('${s.key}')" class="btn-primary" style="width:auto; padding:5px 15px; font-size:12px;">Post</button>
                        </div>
                    </div>
                </div>` + container.innerHTML;
            loadComments(s.key);
        });
    });
}

function vote(pid, opt) {
    db.ref(`posts/${pid}/poll/${opt}/v`).transaction(v => (v || 0) + 1);
}

// --- AI Chatbot Assistant ---
function askAI() {
    const input = document.getElementById('ai-input');
    const msgBox = document.getElementById('ai-msgs');
    const q = input.value.toLowerCase().trim();
    if(!q) return;

    msgBox.innerHTML += `<div style="margin-bottom:8px; font-size:13px;"><b>You:</b> ${q}</div>`;
    
    let res = "I am your Classmate Connect assistant. You can find classmates, share stories, or create polls!";
    if(q.includes("story")) res = "Click the '+' icon in the stories bar at the top to upload a 24-hour story.";
    if(q.includes("poll")) res = "Tap the poll icon in the post box to start a vote with your classmates.";
    if(q.includes("pdf") || q.includes("file")) res = "You can share PDFs by clicking the red document icon in the post creator.";
    
    setTimeout(() => {
        msgBox.innerHTML += `<div style="color:var(--primary); margin-bottom:12px; font-size:13px;"><b>AI:</b> ${res}</div>`;
        msgBox.scrollTop = msgBox.scrollHeight;
    }, 500);
    input.value = "";
}

// --- Chat, Search & Notifications ---
function openChat(uid, name) {
    activeChatUid = uid;
    document.getElementById('chat-user').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid + '_' + uid : uid + '_' + user.uid;
    db.ref('chats/' + cid).on('value', snap => {
        const c = document.getElementById('chat-msgs'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            c.innerHTML += `<div class="msg-bubble ${isMine ? 'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function sendMsg() {
    const v = document.getElementById('chatInput').value.trim();
    if(!v) return;
    const cid = user.uid < activeChatUid ? user.uid + '_' + activeChatUid : activeChatUid + '_' + user.uid;
    db.ref('chats/' + cid).push({ sender: user.uid, text: v, time: Date.now() });
    db.ref(`notifications/${activeChatUid}`).push({ type: 'msg', fromName: user.name, text: v });
    document.getElementById('chatInput').value = "";
}

function search() {
    const sInst = document.getElementById('s-inst').value.toUpperCase().trim();
    const sYear = document.getElementById('s-year').value.trim();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if((sInst && u.inst.toUpperCase().includes(sInst)) || (sYear && u.year == sYear)) {
                res.innerHTML += `<div class="card glass" style="display:flex; justify-content:space-between; align-items:center; padding:15px; margin-bottom:10px;">
                    <span><b>${u.name}</b><br><small>${u.inst || 'N/A'}</small></span>
                    <button onclick="sendReq('${c.key}', this)" class="btn-primary" style="width:auto; padding:8px 15px; font-size:12px;">Connect</button>
                </div>`;
            }
        });
    });
}

function sendReq(toUid, btn) {
    db.ref(`notifications/${toUid}`).push({ type: 'req', fromName: user.name, fromUid: user.uid }).then(() => {
        notify("Request Sent!");
        btn.innerText = "Sent"; btn.disabled = true;
    });
}

function loadFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('friends-list'); if(!list) return;
        list.innerHTML = "";
        snap.forEach(s => {
            db.ref('users/' + s.key).once('value', usnap => {
                const u = usnap.val();
                db.ref('status/' + s.key).on('value', st => {
                    const status = st.val()?.state === 'online' ? 'online' : 'offline';
                    list.innerHTML += `<div class="card glass" onclick="openChat('${s.key}', '${u.name}')" style="cursor:pointer; display:flex; align-items:center; padding:15px; margin-bottom:10px;">
                        <span class="status-dot ${status}"></span><b>${u.name}</b><i class="fas fa-comment-dots" style="margin-left:auto; color:var(--primary)"></i>
                    </div>`;
                });
            });
        });
    });
}

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const l = document.getElementById('notif-list'); if(!l) return;
        l.innerHTML = "";
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

// --- Utilities ---
function toBase64(file) {
    return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); });
}
function resetPostUI() {
    document.getElementById('msgInput').value = "";
    document.getElementById('poll-creator').style.display = 'none';
    document.querySelectorAll('input[type="file"]').forEach(i => i.value = "");
}
function notify(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function togglePollCreator() { const p = document.getElementById('poll-creator'); p.style.display = p.style.display==='none'?'block':'none'; }
function toggleAI() { const a = document.getElementById('ai-window'); a.style.display = a.style.display==='none'?'flex':'none'; }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function saveProfile() {
    const inst = document.getElementById('p-inst').value; const year = document.getElementById('p-year').value;
    if(!inst || !year) return notify("Institution & Year are required!");
    db.ref('users/' + user.uid).update({ inst, uClass: document.getElementById('p-class').value, year, city: document.getElementById('p-city').value }).then(() => notify("Profile Updated!"));
}
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function deletePost(id) { if(confirm("Delete post?")) db.ref('posts/'+id).remove(); }
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
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
