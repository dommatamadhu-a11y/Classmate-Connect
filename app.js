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
let currentGroupId = null;
let pollActive = false;

// 1. Authentication
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
    updateUI(); loadFeed(); loadLibrary(); loadCircle(); listenNotifs(); checkMemories(); autoGroupAlumni();
}

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
    if(user.skills) {
        document.getElementById('u-badge').innerText = user.skills.split(',')[0];
        document.getElementById('u-badge').style.display = "inline-block";
    }
}

// 2. Profile Alert & Auto Grouping (Precise 4-Field Matching)
function updateProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const uClass = document.getElementById('p-class').value.trim();
    const city = document.getElementById('p-city').value.trim();
    const name = document.getElementById('p-name').value.trim();
    const skills = document.getElementById('p-skills').value.trim();

    // Alert for Mandatory Fields
    if(!inst || !year || !uClass || !city) {
        alert("CRITICAL: Please fill Institution Name, Passout Year, Studying Class, and Institution City to join your classmates' group!");
        return;
    }

    const data = { name, inst, year, uClass, city, skills };
    db.ref('users/' + user.uid).update(data).then(() => {
        alert("Profile Saved & Auto-Grouping Sync Complete!");
        autoGroupAlumni();
    });
}

function autoGroupAlumni() {
    if(user.inst && user.year && user.uClass && user.city) {
        // Create unique ID combining 4 specific fields
        const gid = `${user.inst}_${user.year}_${user.uClass}_${user.city}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const gName = `${user.inst} (${user.year}) - ${user.uClass}, ${user.city}`;
        
        db.ref(`groups/${gid}/info`).set({ name: gName, id: gid });
        db.ref(`groups/${gid}/members/${user.uid}`).set({ name: user.name, photo: user.photo });
        loadGroupsList();
    }
}

// 3. Group Chat Logic
function loadGroupsList() {
    db.ref('groups').on('value', snap => {
        const cont = document.getElementById('auto-groups'); cont.innerHTML = "";
        snap.forEach(s => {
            const g = s.val();
            if(g.members && g.members[user.uid]) {
                cont.innerHTML += `<div class="card" onclick="openGroupChat('${s.key}', '${g.info.name}')"><i class="fas fa-users"></i> ${g.info.name}</div>`;
            }
        });
    });
}

function openGroupChat(gid, gname) {
    currentGroupId = gid;
    document.getElementById('g-chat-name').innerText = gname;
    show('group-chat-window');
    db.ref(`group_messages/${gid}`).on('value', snap => {
        const cont = document.getElementById('group-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            cont.innerHTML += `<div class="${isMine?'msg-sent':'msg-received'}">
                <small style="font-size:8px; display:block;">${m.senderName}</small>${m.text}
            </div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendGroupMessage() {
    const text = document.getElementById('g-chatInput').value;
    if(!text) return;
    db.ref(`group_messages/${currentGroupId}`).push({ sender: user.uid, senderName: user.name, text, time: Date.now() });
    document.getElementById('g-chatInput').value = "";
}

// 4. Digital Library & Memories
async function uploadToLibrary() {
    const title = document.getElementById('lib-title').value;
    const file = document.getElementById('f-lib').files[0];
    if(!title || !file) return alert("Title and File required");
    if(file.size > 2 * 1024 * 1024) return alert("File too large (Max 2MB)");
    const b64 = await toBase64(file);
    db.ref('library').push({ title, file: b64, uploader: user.name, time: Date.now() });
}

function loadLibrary() {
    db.ref('library').on('value', snap => {
        const cont = document.getElementById('library-list'); cont.innerHTML = "";
        snap.forEach(s => {
            const d = s.val();
            cont.innerHTML += `<div class="lib-item" onclick="downloadFile('${d.file}', '${d.title}')">
                <i class="fas fa-file-pdf"></i><br><small>${d.title}</small>
            </div>`;
        });
    });
}

function checkMemories() {
    db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
        snap.forEach(s => {
            const p = s.val(); const pD = new Date(p.time); const today = new Date();
            if(pD.getDate()==today.getDate() && pD.getMonth()==today.getMonth() && pD.getFullYear()<today.getFullYear()) {
                document.getElementById('mem-banner').style.display = "block";
                document.getElementById('mem-text').innerText = p.msg;
            }
        });
    });
}

// 5. Feed, Search & Other Features
function togglePoll() { pollActive = !pollActive; document.getElementById('poll-ui').style.display = pollActive?'block':'none'; }

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    let post = { uid: user.uid, userName: user.name, msg, time: Date.now(), likes: 0, skills: user.skills };
    if(pollActive) post.poll = { q: document.getElementById('p-q').value, o1: document.getElementById('p-1').value, o2: document.getElementById('p-2').value, v1:0, v2:0 };
    if(file) post.media = await toBase64(file);
    db.ref('posts').push(post);
    document.getElementById('msgInput').value = ""; togglePoll();
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('feed-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            cont.innerHTML = `<div class="card">
                <b>${p.userName}</b><p>${p.msg}</p>
                ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:8px;">` : ""}
                <span onclick="like('${pid}')"><i class="fas fa-heart"></i> ${p.likes}</span>
            </div>` + cont.innerHTML;
        });
    });
}

function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    const year = document.getElementById('s-year').value;
    const city = document.getElementById('s-city').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(u.inst.toLowerCase().includes(inst) && (!year || u.year == year) && u.city.toLowerCase().includes(city)) {
                res.innerHTML += `<div class="card">${u.name} <button onclick="sendReq('${c.key}')">Connect</button></div>`;
            }
        });
    });
}

// Utility Functions
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function downloadFile(b, n) { const a = document.createElement('a'); a.href = b; a.download = n; a.click(); }
function shareInvite() { window.open(`https://api.whatsapp.com/send?text=Join Classmate Connect Global!`, '_blank'); }
function logout() { auth.signOut().then(() => location.reload()); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function like(p) { db.ref(`posts/${p}/likes`).transaction(c => (c || 0) + 1); }
function askAI() { alert("AI Thinking about your career..."); }
function sendReq(t) { db.ref(`notifications/${t}`).push({from:user.name, fromUid:user.uid}); alert("Sent!"); }
function loadCircle() { db.ref(`friends/${user.uid}`).on('value', snap => { const fl = document.getElementById('friends-list'); fl.innerHTML = ""; snap.forEach(s => { fl.innerHTML += `<div class="card" onclick="openChat('${s.key}','${s.val().name}')">${s.val().name}</div>`; }); }); }
function listenNotifs() { db.ref(`notifications/${user.uid}`).on('value', snap => { const l = document.getElementById('notif-list'); l.innerHTML = ""; snap.forEach(s => { l.innerHTML += `<div class="card">${s.val().from} <button onclick="accept('${s.key}','${s.val().fromUid}','${s.val().from}')">Accept</button></div>`; }); }); }
function accept(k,f,n) { db.ref(`friends/${user.uid}/${f}`).set({name:n}); db.ref(`friends/${f}/${user.uid}`).set({name:user.name}); db.ref(`notifications/${user.uid}/${k}`).remove(); }
function openChat(t,n) { currentChatId = user.uid < t ? user.uid+"_"+t : t+"_"+user.uid; document.getElementById('chat-t-name').innerText = n; show('chat-window'); db.ref(`chats/${currentChatId}`).on('value', snap => { const c = document.getElementById('chat-messages'); c.innerHTML = ""; snap.forEach(s => { const m = s.val(); c.innerHTML += `<div class="${m.sender===user.uid?'msg-sent':'msg-received'}">${m.text}</div>`; }); }); }
function sendChatMessage() { const t = document.getElementById('chatInput').value; db.ref(`chats/${currentChatId}`).push({sender:user.uid, text:t}); document.getElementById('chatInput').value = ""; }
