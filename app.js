// Firebase Configuration (Same as yours)
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
let currentChatId = null;
let pollActive = false;

// 1. Authentication & Lifecycle
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "", skills: d.skills || "" };
            initApp();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function initApp() {
    updateProfileUI(); loadFeed(); loadLibrary(); loadCircle(); listenNotifs(); checkMemories(); autoGroupAlumni(); syncOnlineStatus();
}

// 2. Global Profile & Skill Badges
function updateProfileUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
    
    if(user.skills) {
        document.getElementById('u-badge').innerText = user.skills.split(',')[0];
        document.getElementById('u-badge').style.display = "inline-block";
    }
}

function updateProfile() {
    const data = {
        name: document.getElementById('p-name').value,
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        uClass: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value,
        skills: document.getElementById('p-skills').value
    };
    db.ref('users/' + user.uid).update(data).then(() => alert("Profile Updated Globally!"));
}

// 3. Digital Library (Shared Resources)
async function uploadToLibrary() {
    const title = document.getElementById('lib-title').value;
    const file = document.getElementById('f-lib').files[0];
    if(!title || !file) return alert("Add title and file");
    
    if(file.size > 2 * 1024 * 1024) return alert("File too large! Max 2MB for Base64");
    
    const b64 = await toBase64(file);
    const libEntry = { title, file: b64, type: file.type, uploader: user.name, time: Date.now() };
    db.ref('library').push(libEntry);
    document.getElementById('lib-title').value = "";
}

function loadLibrary() {
    db.ref('library').on('value', snap => {
        const cont = document.getElementById('library-list'); cont.innerHTML = "";
        snap.forEach(s => {
            const d = s.val();
            cont.innerHTML += `<div class="lib-item" onclick="downloadFile('${d.file}', '${d.title}')">
                <i class="fas fa-file-pdf" style="font-size:30px; color:var(--primary);"></i><br>
                <small>${d.title}</small><br>
                <span style="font-size:8px;">By: ${d.uploader}</span>
            </div>`;
        });
    });
}

// 4. Memories (On This Day)
function checkMemories() {
    db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
        snap.forEach(s => {
            const p = s.val();
            const pDate = new Date(p.time); const today = new Date();
            if(pDate.getDate() === today.getDate() && pDate.getMonth() === today.getMonth() && pDate.getFullYear() < today.getFullYear()) {
                document.getElementById('memory-banner').style.display = "block";
                document.getElementById('memory-text').innerText = `"${p.msg}" - Shared ${today.getFullYear() - pDate.getFullYear()} year(s) ago.`;
            }
        });
    });
}

// 5. Feed, Polls, Translation
function togglePoll() { pollActive = !pollActive; document.getElementById('poll-ui').style.display = pollActive ? 'block' : 'none'; }

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    let post = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), likes: 0, skills: user.skills };
    
    if(pollActive) post.poll = { q: document.getElementById('p-q').value, o1: document.getElementById('p-1').value, o2: document.getElementById('p-2').value, v1: 0, v2: 0 };
    if(file) post.media = await toBase64(file);
    
    db.ref('posts').push(post);
    document.getElementById('msgInput').value = ""; togglePoll();
}

function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('feed-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            cont.innerHTML = `
                <div class="card">
                    <div style="display:flex; justify-content:space-between;">
                        <b>${p.userName} ${p.skills ? `<span class="badge-icon">${p.skills.split(',')[0]}</span>` : ""}</b>
                        ${p.uid === user.uid ? `<i class="fas fa-trash" onclick="deletePost('${pid}')"></i>` : `<i class="fas fa-flag" onclick="reportPost('${pid}')"></i>`}
                    </div>
                    <p id="msg-${pid}">${p.msg}</p>
                    ${p.media ? (p.media.includes('video') ? `<video src="${p.media}" controls style="width:100%; border-radius:8px;"></video>` : `<img src="${p.media}" style="width:100%; border-radius:8px;">`) : ""}
                    ${p.poll ? `<div style="border:1px solid #ddd; padding:10px; border-radius:8px;"><b>${p.poll.q}</b><br><button onclick="vote('${pid}','v1')">${p.poll.o1}(${p.poll.v1})</button> <button onclick="vote('${pid}','v2')">${p.poll.o2}(${p.poll.v2})</button></div>` : ""}
                    <div style="margin-top:10px; display:flex; gap:15px; font-size:12px; font-weight:600; color:var(--primary); cursor:pointer;">
                        <span onclick="like('${pid}')"><i class="fas fa-heart"></i> ${p.likes}</span>
                        <span onclick="translateUI('${pid}', '${p.msg}')"><i class="fas fa-language"></i> Translate</span>
                    </div>
                </div>` + cont.innerHTML;
        });
    });
}

// 6. Search & Connections
function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    const year = document.getElementById('s-year').value;
    const city = document.getElementById('s-city').value.toLowerCase();
    
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(u.inst.toLowerCase().includes(inst) && (!year || u.year == year) && u.city.toLowerCase().includes(city)) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst} | ${u.year}</small></div>
                    <button onclick="sendConnect('${c.key}')" class="btn-primary" style="width:auto; padding:5px 10px;">Connect</button>
                </div>`;
            }
        });
    });
}

// 7. Smart Chat & Deletion
function sendChatMessage() {
    const txt = document.getElementById('chatInput').value;
    const f = document.getElementById('chat-f').files[0];
    if(!txt && !f) return;
    
    const msg = { sender: user.uid, time: Date.now() };
    if(txt) msg.text = txt;
    if(f) toBase64(f).then(b => { msg.media = b; db.ref(`chats/${currentChatId}`).push(msg); });
    else db.ref(`chats/${currentChatId}`).push(msg);
    document.getElementById('chatInput').value = "";
}

function openChat(tid, tname, timg) {
    currentChatId = user.uid < tid ? user.uid+"_"+tid : tid+"_"+user.uid;
    document.getElementById('chat-t-name').innerText = tname;
    document.getElementById('chat-t-img').src = timg;
    show('chat-window');
    
    db.ref(`chats/${currentChatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            const del = isMine ? `<i class="fas fa-trash-alt" style="font-size:9px; margin-left:8px;" onclick="delMsg('${s.key}')"></i>` : "";
            cont.innerHTML += `<div class="${isMine?'msg-sent':'msg-received'}">${m.text || `<img src="${m.media}" style="width:100px;">`}${del}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

// Utilities & Features
function translateUI(pid, txt) { 
    const lang = document.getElementById('target-lang').value;
    document.getElementById(`msg-${pid}`).innerText = `[Translating to ${lang}...]`;
    setTimeout(() => { document.getElementById(`msg-${pid}`).innerText = `[${lang}]: ${txt} (Simulated)`; }, 1000);
}

function shareInvite() { window.open(`https://api.whatsapp.com/send?text=Hey! Join our global classmate network here: ${window.location.href}`, '_blank'); }
function syncOnlineStatus() { db.ref(`status/${user.uid}`).set({online:true, last:Date.now()}); db.ref(`status/${user.uid}`).onDisconnect().set({online:false, last:Date.now()}); }
function autoGroupAlumni() { if(user.inst && user.year) db.ref(`groups/${user.inst}_${user.year}/members/${user.uid}`).set(user.name); }
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function downloadFile(b64, name) { const a = document.createElement('a'); a.href = b64; a.download = name; a.click(); }
function askAI() { 
    const i = document.getElementById('aiInput'); 
    document.getElementById('ai-msgs').innerHTML += `<div class="msg-sent">${i.value}</div>`;
    setTimeout(() => { document.getElementById('ai-msgs').innerHTML += `<div class="msg-received">Based on your Profile (${user.skills}), I recommend learning Advanced Data Analysis for better career growth.</div>`; }, 1000);
    i.value = "";
}
function sendConnect(t) { db.ref(`notifications/${t}`).push({from:user.name, fromUid:user.uid}); alert("Sent!"); }
function loadCircle() { db.ref(`friends/${user.uid}`).on('value', snap => { const fl = document.getElementById('friends-list'); fl.innerHTML = ""; snap.forEach(s => { fl.innerHTML += `<div class="card" onclick="openChat('${s.key}','${s.val().name}','${s.val().photo}')">${s.val().name}</div>`; }); }); }
function listenNotifs() { db.ref(`notifications/${user.uid}`).on('value', snap => { const l = document.getElementById('notif-list'); l.innerHTML = ""; snap.forEach(s => { l.innerHTML += `<div class="card">${s.val().from} wants to connect. <button onclick="accept('${s.key}','${s.val().fromUid}','${s.val().from}')">Accept</button></div>`; }); }); }
function accept(k,f,n) { db.ref(`friends/${user.uid}/${f}`).set({name:n, photo:'https://via.placeholder.com/50'}); db.ref(`friends/${f}/${user.uid}`).set({name:user.name, photo:user.photo}); db.ref(`notifications/${user.uid}/${k}`).remove(); }
function like(p) { db.ref(`posts/${p}/likes`).transaction(c => (c || 0) + 1); }
function deletePost(p) { if(confirm("Delete?")) db.ref(`posts/${p}`).remove(); }
function reportPost(p) { alert("Reported to Admin."); }
function toggleDarkMode() { document.body.classList.toggle('dark'); }
