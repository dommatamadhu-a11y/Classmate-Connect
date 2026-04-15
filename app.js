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

// 1. Auth & Skill Badge Logic
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "", skills: d.skills || "" };
            updateUI(); loadFeed(); listenNotifs(); loadCircle(); syncStatus(); autoGroup();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
    
    // Skill Badge Visibility
    if(user.skills) {
        document.getElementById('skill-badge').innerText = user.skills.split(',')[0].toUpperCase();
        document.getElementById('skill-badge').style.display = "inline-block";
    }
}

function syncStatus() {
    db.ref(`status/${user.uid}`).set({ online: true, last: Date.now() });
    db.ref(`status/${user.uid}`).onDisconnect().set({ online: false, last: Date.now() });
}

// 2. Feed & Auto Translation (Simulated for API safety)
async function translateText(text, targetLang, element) {
    element.innerText = "Translating...";
    // In a real global app, we use Google Cloud Translate API here.
    // Simulating translation for UI demonstration.
    setTimeout(() => {
        element.innerText = `[Translated to ${targetLang}]: ${text}`;
        element.style.color = "var(--success)";
    }, 800);
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            cont.innerHTML = `
                <div class="card">
                    <b>${p.userName}</b> ${p.skills ? `<span class="badge-icon">${p.skills.split(',')[0]}</span>` : ""}
                    <p id="txt-${pid}">${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:8px;">` : ""}
                    <div style="margin-top:10px; display:flex; gap:15px; font-size:12px; font-weight:600; color:var(--primary);">
                        <span onclick="likePost('${pid}')"><i class="fas fa-heart"></i> ${p.likes || 0}</span>
                        <span onclick="translateText('${p.msg}', 'Telugu', document.getElementById('txt-${pid}'))"><i class="fas fa-language"></i> Translate</span>
                        ${p.uid === user.uid ? `<span onclick="deletePost('${pid}')" style="color:var(--danger);"><i class="fas fa-trash"></i> Delete</span>` : ""}
                    </div>
                </div>` + cont.innerHTML;
        });
    });
}

// 3. Smart Search & Profile
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
                    <button onclick="sendReq('${c.key}')" class="btn-primary" style="width:auto; margin:0; padding:5px 10px;">Connect</button>
                </div>`;
            }
        });
    });
}

function updateProfile() {
    const d = { 
        name: document.getElementById('p-name').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        uClass: document.getElementById('p-class').value, 
        city: document.getElementById('p-city').value,
        skills: document.getElementById('p-skills').value
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Global Profile Sync Complete!"));
}

// 4. Chat & Media (Files/Images)
function sendChatMessage() {
    const t = document.getElementById('chatInput').value;
    const f = document.getElementById('chat-file').files[0];
    if(!t && !f) return;
    
    const cid = currentChatId;
    const msgData = { sender: user.uid, time: Date.now() };
    if(t) msgData.text = t;
    if(f) toBase64(f).then(b64 => { msgData.media = b64; db.ref(`chats/${cid}`).push(msgData); });
    else db.ref(`chats/${cid}`).push(msgData);
    
    document.getElementById('chatInput').value = "";
}

function openChat(tid, tname) {
    currentChatId = user.uid < tid ? user.uid+"_"+tid : tid+"_"+user.uid;
    document.getElementById('chat-target-name').innerText = tname;
    show('chat-window');
    
    db.ref(`chats/${currentChatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            let content = m.text ? `<span>${m.text}</span>` : `<img src="${m.media}" style="width:150px; border-radius:8px;">`;
            cont.innerHTML += `<div class="${isMine?'msg-sent':'msg-received'}">${content}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

// 5. Automatic Grouping
function autoGroup() {
    if(user.inst && user.year) {
        const gid = (user.inst + "_" + user.year).replace(/\s/g, '');
        db.ref(`groups/${gid}/members/${user.uid}`).set(user.name);
        loadGroups();
    }
}

function loadGroups() {
    db.ref('groups').on('value', snap => {
        const gl = document.getElementById('groups-list'); gl.innerHTML = "";
        snap.forEach(s => {
            if(s.val().members && s.val().members[user.uid]) {
                gl.innerHTML += `<div class="card" onclick="alert('Group Chat Coming Soon')"><i class="fas fa-users"></i> ${s.key.replace('_',' ')}</div>`;
            }
        });
    });
}

// Utilities
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}
function shareInvite() { window.open(`https://api.whatsapp.com/send?text=Join%20me%20on%20Classmate%20Connect%20Global!`, '_blank'); }
function toggleDarkMode() { document.body.classList.toggle('dark'); }
function changeTheme(v) { document.body.className = v; }
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function logout() { auth.signOut().then(() => location.reload()); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function likePost(pid) { db.ref(`posts/${pid}/likes`).transaction(c => (c || 0) + 1); }
function deletePost(pid) { if(confirm("Delete?")) db.ref(`posts/${pid}`).remove(); }
function askAI() { alert("AI Assistant: I am checking global career trends for you!"); }
function sendReq(t) { db.ref(`notifications/${t}`).push({ from: user.name, fromUid: user.uid }); alert("Connection Request Sent!"); }
function loadCircle() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => { fl.innerHTML += `<div class="card" onclick="openChat('${s.key}','${s.val().name}')">${s.val().name}</div>`; });
    });
}
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const l = document.getElementById('notif-list'); l.innerHTML = "";
        snap.forEach(s => {
            l.innerHTML += `<div class="card">${s.val().from} wants to connect. <button onclick="acceptReq('${s.key}','${s.val().fromUid}','${s.val().from}')">Accept</button></div>`;
        });
    });
}
function acceptReq(k, f, n) { db.ref(`friends/${user.uid}/${f}`).set({name: n}); db.ref(`friends/${f}/${user.uid}`).set({name: user.name}); db.ref(`notifications/${user.uid}/${k}`).remove(); }
