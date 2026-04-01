const firebaseConfig = {
  apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
  authDomain: "class-connect-b58f0.firebaseapp.com",
  databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "class-connect-b58f0",
  storageBucket: "class-connect-b58f0.appspot.com",
  messagingSenderId: "836461719745",
  appId: "1:836461719745:web:f827862e4db4954626a440"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";
let blockedList = [];

// --- UTILS ---
function cleanString(str) { return str ? str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : ""; }
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.className = "show"; setTimeout(() => t.className = "", 3000); }

async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 400; let w = img.width, h = img.height;
                if (w > MAX) { h *= MAX / w; w = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// --- AUTH & BLOCKING ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { uid: u.uid, name: u.displayName, photo: d?.photo || u.photoURL, inst: d?.inst||"", year: d?.year||"", groupKey: d?cleanString(d.inst)+d.year:"" };
            blockedList = Object.keys(d?.blocked || {});
            updateUI(d, u.email); loadFeed(); checkUnread();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function updateUI(d, email) {
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-email-display').innerText = email;
    if(d) {
        document.getElementById('p-inst').value = d.inst||""; document.getElementById('p-inst-city').value = d.instCity||"";
        document.getElementById('p-year').value = d.year||""; document.getElementById('p-group').value = d.group||"";
    }
}

// --- FEED & REPORTING ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!user.inst) return alert("Complete profile first!");
    const file = document.getElementById('feedPhotoInput').files[0];
    let imgData = file ? await processImage(file) : "";
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, img: imgData, groupKey: user.groupKey, time: Date.now() });
    document.getElementById('msgInput').value = ""; document.getElementById('feedPhotoInput').value = "";
    showToast("Posted!");
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            if(p.groupKey === user.groupKey && !blockedList.includes(p.uid)) {
                cont.innerHTML += `<div class="card">
                    <span class="report-btn" onclick="reportPost('${s.key}')">Report</span>
                    <b>${p.name}</b><p>${p.msg}</p>
                    ${p.img ? `<img src="${p.img}" class="post-img">`:''}
                </div>`;
            }
        });
    });
}

function reportPost(pid) {
    if(confirm("Report this post for abuse?")) {
        db.ref('reports/'+pid).push({ reporter: user.uid, time: Date.now() });
        showToast("Post reported.");
    }
}

// --- SEARCH & CHAT ---
function searchAlumni() {
    const sInst = cleanString(document.getElementById('s-inst').value);
    const sCity = cleanString(document.getElementById('s-inst-city').value);
    const sYear = document.getElementById('s-year').value;
    const sClass = cleanString(document.getElementById('s-class').value);

    db.ref('users').once('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid || blockedList.includes(c.key)) return;
            const match = (!sInst || cleanString(u.inst).includes(sInst)) && 
                          (!sCity || cleanString(u.instCity).includes(sCity)) && 
                          (!sYear || u.year == sYear) && 
                          (!sClass || cleanString(u.group).includes(sClass));
            if(match) {
                list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst} (${u.year})</small></div>
                    <button class="btn btn-blue" style="width:auto; padding:5px 12px;" onclick="openChat('${c.key}','${u.name}')">Chat</button>
                </div>`;
            }
        });
    });
}

function openChat(uid, name) {
    currentChatFriendUID = uid;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    document.getElementById('block-btn').onclick = () => blockUser(uid);
    loadMessages();
}

function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim(); if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, text: txt, time: Date.now(), read: false });
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            if(m.sender !== user.uid) db.ref('private_messages/'+cid+'/'+s.key).update({read: true});
            c.innerHTML += `<div class="msg-bubble ${m.sender === user.uid?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function checkUnread() {
    db.ref('private_messages').on('value', snap => {
        let hasUnread = false;
        snap.forEach(convo => {
            if(convo.key.includes(user.uid)) {
                convo.forEach(msg => {
                    if(msg.val().sender !== user.uid && msg.val().read === false) hasUnread = true;
                });
            }
        });
        document.getElementById('chat-dot').style.display = hasUnread ? "block" : "none";
    });
}

function blockUser(uid) {
    if(confirm("Block this user? They won't be able to contact you.")) {
        db.ref('users/'+user.uid+'/blocked/'+uid).set(true);
        closeChat();
        showToast("User blocked.");
    }
}

// --- PROFILE ---
async function uploadProfilePhoto() {
    const file = document.getElementById('profilePhotoInput').files[0];
    if(!file) return;
    const base64 = await processImage(file);
    db.ref('users/'+user.uid).update({ photo: base64 }).then(() => showToast("Profile photo updated!"));
}

function saveProfile() {
    db.ref('users/'+user.uid).update({
        inst: document.getElementById('p-inst').value, instCity: document.getElementById('p-inst-city').value,
        year: document.getElementById('p-year').value, group: document.getElementById('p-group').value
    }).then(() => showToast("Profile saved!"));
}

function show(id, t, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function inviteFriend() { window.open(`https://wa.me/?text=Join our network: ${window.location.href}`, '_blank'); }
