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
let currentChatFriendId = null;

// Handle Auth State
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { 
                uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, 
                inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "" 
            };
            updateUI(); loadFeed(); loadStories(); listenNotifs(); loadFriends();
        });
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
}

function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    if(el && el.classList) el.classList.add('active-nav');
}

// 4-Filter Search Logic
function search() {
    const sInst = document.getElementById('s-inst').value.toLowerCase().trim();
    const sYear = document.getElementById('s-year').value.trim();
    const sClass = document.getElementById('s-class').value.toLowerCase().trim();
    const sCity = document.getElementById('s-city').value.toLowerCase().trim();

    const resDiv = document.getElementById('search-results');
    resDiv.innerHTML = "<p style='text-align:center;'>Searching...</p>";

    db.ref('users').once('value', snap => {
        resDiv.innerHTML = "";
        let found = false;
        
        snap.forEach(child => {
            const u = child.val();
            if(child.key === user.uid) return; // Skip self

            // Multi-Filter Logic: If filter is provided, it must match.
            const matchInst = !sInst || (u.inst && u.inst.toLowerCase().includes(sInst));
            const matchYear = !sYear || (u.year && u.year.toString() === sYear);
            const matchClass = !sClass || (u.uClass && u.uClass.toLowerCase().includes(sClass));
            const matchCity = !sCity || (u.city && u.city.toLowerCase().includes(sCity));

            if(matchInst && matchYear && matchClass && matchCity) {
                found = true;
                resDiv.innerHTML += `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>
                            <b>${u.name}</b><br>
                            <small>${u.inst || 'No Institution'} | ${u.year || 'N/A'}</small><br>
                            <small>${u.city || 'No City'}</small>
                        </span>
                        <button onclick="sendReq('${child.key}', '${u.name}')" class="btn-primary" style="width:auto; padding:5px 10px;">Connect</button>
                    </div>`;
            }
        });
        if(!found) resDiv.innerHTML = "<p style='text-align:center; color:red;'>No classmates found with these filters.</p>";
    });
}

// Global Feed & Posting
async function handlePost() {
    const msg = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('f-img').files[0];
    const groupKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";

    if(!msg && !file) return;

    let postData = { 
        uid: user.uid, userName: user.name, userPhoto: user.photo, 
        msg, time: Date.now(), groupKey, likesCount: 0 
    };

    if(file) postData.media = await toBase64(file);

    db.ref('posts').push(postData);
    document.getElementById('msgInput').value = "";
    document.getElementById('f-img').value = "";
}

function loadFeed() {
    const groupKey = (user.inst + user.year).replace(/\s/g, '').toUpperCase() || "GLOBAL";
    db.ref('posts').orderByChild('groupKey').equalTo(groupKey).on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            cont.innerHTML = `
                <div class="card">
                    <b>${p.userName}</b><br>
                    <small>${new Date(p.time).toLocaleString()}</small>
                    <p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" class="post-img">` : ""}
                </div>` + cont.innerHTML;
        });
    });
}

// Friends & Chat
function loadFriends() {
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const fl = document.getElementById('friends-list'); fl.innerHTML = "";
        snap.forEach(s => {
            const f = s.val();
            fl.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <b>${f.name}</b>
                    <button onclick="openChat('${s.key}', '${f.name}')" style="background:var(--success); color:white; border:none; padding:5px 10px; border-radius:5px;">Chat</button>
                </div>`;
        });
    });
}

function openChat(fid, fname) {
    currentChatFriendId = fid;
    document.getElementById('chat-friend-name').innerText = fname;
    show('chat-window');
    loadMessages(fid);
}

function loadMessages(fid) {
    const chatId = user.uid < fid ? user.uid + "_" + fid : fid + "_" + user.uid;
    db.ref(`chats/${chatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            cont.innerHTML += `<div class="${cls}">${m.text}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendMessage() {
    const text = document.getElementById('chatInput').value.trim();
    if(!text || !currentChatFriendId) return;
    const chatId = user.uid < currentChatFriendId ? user.uid + "_" + currentChatFriendId : currentChatFriendId + "_" + user.uid;
    db.ref(`chats/${chatId}`).push({ sender: user.uid, text, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

// Notifications & Requests
function sendReq(tUid, tName) {
    db.ref(`notifications/${tUid}`).push({ from: user.name, fromUid: user.uid });
    alert("Request Sent to " + tName);
}

function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const badge = document.getElementById('notif-badge');
        const list = document.getElementById('notif-list'); list.innerHTML = "";
        if(snap.exists()) {
            badge.innerText = snap.numChildren(); badge.style.display = "block";
            snap.forEach(s => {
                const n = s.val();
                list.innerHTML += `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <span><b>${n.from}</b> wants to connect.</span>
                        <button onclick="acceptReq('${s.key}', '${n.fromUid}', '${n.from}')" class="btn-primary" style="width:auto; padding:5px 10px;">Accept</button>
                    </div>`;
            });
        } else badge.style.display = "none";
    });
}

function acceptReq(nid, fUid, fName) {
    db.ref(`friends/${user.uid}/${fUid}`).set({ name: fName });
    db.ref(`friends/${fUid}/${user.uid}`).set({ name: user.name });
    db.ref(`notifications/${user.uid}/${nid}`).remove();
}

// Helpers & Profile
function saveProfile() {
    const d = {
        name: document.getElementById('p-name-input').value.trim(),
        inst: document.getElementById('p-inst').value.trim(),
        year: document.getElementById('p-year').value.trim(),
        uClass: document.getElementById('p-class').value.trim(),
        city: document.getElementById('p-city').value.trim()
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Saved!"));
}

function loadStories() { /* Stories logic remains same as previous */ }
function toBase64(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
