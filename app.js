// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
  authDomain: "class-connect-b58f0.firebaseapp.com",
  databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "class-connect-b58f0",
  storageBucket: "class-connect-b58f0.appspot.com",
  messagingSenderId: "836461719745",
  appId: "1:836461719745:web:f827862e4db4954626a440",
  measurementId: "G-8QT4VQ5YW5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";
let blockedUsers = [];

// --- UTILS ---
function cleanString(str) { return str ? str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : ""; }
function formatTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return new Date(ts).toLocaleDateString();
}

async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 500; let w = img.width, h = img.height;
                if (w > MAX) { h *= MAX / w; w = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// --- AUTH ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { uid: u.uid, name: u.displayName, photo: d?.photo || u.photoURL, inst: d?.inst||"", year: d?.year||"", groupKey: d?cleanString(d.inst)+d.year:"" };
            updateUI(d, u.email); loadFeed();
        });
    } else {
        document.getElementById('login-overlay').style.display = "flex";
    }
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

// --- PROFILE PHOTO UPLOAD ---
async function uploadProfilePhoto() {
    const file = document.getElementById('profilePhotoInput').files[0];
    if(!file) return;
    showToast("Updating profile photo...");
    const b = await processImage(file);
    db.ref('users/'+user.uid).update({ photo: b }).then(() => showToast("Photo Updated!"));
}

// --- FEED & POLLS ---
function togglePostType(type) {
    document.getElementById('msg-area').style.display = type === 'msg' ? 'block' : 'none';
    document.getElementById('poll-area').style.display = type === 'poll' ? 'block' : 'none';
    document.getElementById('tab-msg').style.color = type === 'msg' ? 'var(--primary)' : 'var(--sub)';
    document.getElementById('tab-poll').style.color = type === 'poll' ? 'var(--primary)' : 'var(--sub)';
}

async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('feedPhotoInput').files[0];
    if(!user.inst) return alert("Complete profile first!");
    let imgData = file ? await processImage(file) : "";
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, img: imgData, type: 'msg', groupKey: user.groupKey, time: Date.now() });
    document.getElementById('msgInput').value = ""; document.getElementById('feedPhotoInput').value = "";
}

function handlePollPost() {
    const q = document.getElementById('pollQ').value.trim();
    const o1 = document.getElementById('opt1').value.trim();
    const o2 = document.getElementById('opt2').value.trim();
    if(!q || !o1 || !o2) return alert("Fill all fields!");
    db.ref('posts').push({ uid: user.uid, name: user.name, question: q, options: { opt1: {txt: o1, votes: 0}, opt2: {txt: o2, votes: 0} }, type: 'poll', groupKey: user.groupKey, time: Date.now() });
    document.getElementById('pollQ').value = ""; document.getElementById('opt1').value = ""; document.getElementById('opt2').value = "";
    togglePostType('msg');
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        let posts = []; snap.forEach(s => { posts.push({id: s.key, ...s.val()}); });
        posts.reverse().forEach(p => {
            if(p.groupKey === user.groupKey) {
                let content = p.type === 'poll' ? `<b>${p.question}</b>` : `<p>${p.msg}</p>${p.img ? `<img src="${p.img}" class="post-img">`:''}`;
                cont.innerHTML += `<div class="card"><small><b>${p.name}</b> • ${formatTime(p.time)}</small>${content}</div>`;
            }
        });
    });
}

// --- NETWORK & CHAT ---
function searchAlumni() {
    const sInst = cleanString(document.getElementById('s-inst').value);
    const sYear = document.getElementById('s-year').value;
    db.ref('users').once('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(cleanString(u.inst).includes(sInst) && u.year == sYear) {
                list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between;"><div><b>${u.name}</b></div><button class="btn btn-blue" style="width:auto;" onclick="openChat('${c.key}','${u.name}')">Chat</button></div>`;
            }
        });
    });
}

function openChat(uid, name) { currentChatFriendUID = uid; document.getElementById('chat-with-name').innerText = name; document.getElementById('chat-window').style.display = "flex"; loadMessages(); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim(); if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('privateMsgInput').value = "";
}
function loadMessages() {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(), isMine = m.sender === user.uid;
            c.innerHTML += `<div class="msg-bubble ${isMine?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function saveProfile() {
    db.ref('users/'+user.uid).update({
        inst: document.getElementById('p-inst').value, instCity: document.getElementById('p-inst-city').value,
        year: document.getElementById('p-year').value, group: document.getElementById('p-group').value
    }).then(() => showToast("Profile Updated!"));
}

function show(id, t, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.className = "show"; setTimeout(() => t.className = "", 3000); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function inviteFriend() {
    const msg = `Join our Alumni Connect network: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}
