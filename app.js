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

auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { uid: u.uid, name: u.displayName, photo: u.photoURL, inst: d?.inst || "", year: d?.year || "", groupKey: d ? (d.inst + d.year).replace(/\s+/g,'').toUpperCase() : "" };
            updateUI();
        });
    } else {
        document.getElementById('login-overlay').style.display = "flex";
    }
});

function loginWithGoogle() { auth.signInWithPopup(provider); }

function updateUI() {
    if(!user) return;
    document.getElementById('header-user-name').innerText = user.name;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
}

// --- IMAGE HELPER ---
function toBase64(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => res(reader.result);
    });
}

// --- FEED (POST, LIKE, COMMENT) ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('feedPhotoInput').files[0];
    if(!user.inst) return alert("Update profile first!");
    if(!txt && !file) return;

    let b64 = file ? await toBase64(file) : "";
    db.ref('posts').push({
        uid: user.uid, name: user.name, msg: txt, img: b64, groupKey: user.groupKey,
        likes: 0, time: new Date().toLocaleTimeString()
    });
    document.getElementById('msgInput').value = "";
    document.getElementById('feedPhotoInput').value = "";
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(s => {
        const p = s.val();
        if(p.groupKey === user.groupKey) {
            let id = s.key;
            let img = p.img ? `<img src="${p.img}" class="post-img">` : "";
            let postHtml = `
                <div class="card">
                    <b>${p.name}</b> <small>${p.time}</small>
                    <p>${p.msg}</p>${img}
                    <div class="action-bar">
                        <span class="action-item" onclick="likePost('${id}')">❤️ ${p.likes || 0}</span>
                        <span class="action-item" onclick="addComment('${id}')">💬 Comment</span>
                    </div>
                    <div id="comments-${id}"></div>
                </div>`;
            cont.innerHTML = postHtml + cont.innerHTML;
            loadComments(id);
        }
    });
});

function likePost(id) {
    const ref = db.ref('posts/' + id + '/likes');
    ref.transaction(c => (c || 0) + 1);
}

function addComment(id) {
    let msg = prompt("Enter comment:");
    if(msg) db.ref('comments/' + id).push({ name: user.name, msg: msg });
}

function loadComments(id) {
    db.ref('comments/' + id).limitToLast(3).on('value', snap => {
        const cDiv = document.getElementById('comments-' + id);
        cDiv.innerHTML = "";
        snap.forEach(s => {
            const c = s.val();
            cDiv.innerHTML += `<div class="comment-box"><b>${c.name}:</b> ${c.msg}</div>`;
        });
    });
}

// --- CHAT ---
async function sendPhoto() {
    const file = document.getElementById('chatPhotoInput').files[0];
    if(file) {
        const b64 = await toBase64(file);
        const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
        db.ref('private_messages/' + chatId).push({ sender: user.uid, img: b64 });
    }
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).push({ sender: user.uid, text: msg });
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            let body = m.img ? `<img src="${m.img}" class="chat-img">` : m.text;
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${body}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

// --- NAVIGATION & FRIENDS ---
function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    const res = document.getElementById('my-friends-list');
    res.innerHTML = "Searching...";
    db.ref('users').once('value', snap => {
        res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if(c.key !== user.uid && u.inst?.toUpperCase().includes(inst)) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between;">
                    <b>${u.name}</b>
                    <button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="addFriend('${c.key}', '${u.name}')">Connect</button>
                </div>`;
            }
        });
    });
}

function addFriend(fUid, fName) {
    db.ref('friends/' + user.uid + '/' + fUid).set({ name: fName });
    db.ref('friends/' + fUid + '/' + user.uid).set({ name: user.name });
    alert("Connected!");
}

function loadMyFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>My Friends</h4>";
        snap.forEach(c => {
            list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <b>${c.val().name}</b>
                <button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="openChat('${c.key}', '${c.val().name}')">Chat</button>
            </div>`;
        });
    });
}

function openChat(uid, name) {
    currentChatFriendUID = uid;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }

function clearChat() {
    if(confirm("Clear chat?")) {
        const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
        db.ref('private_messages/' + chatId).remove();
    }
}

function saveProfile() {
    db.ref('users/' + user.uid).update({
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value
    }).then(() => alert("Saved!"));
}

function logout() { auth.signOut().then(() => location.reload()); }

function deleteAccount() {
    if(confirm("Delete account permanently?")) {
        db.ref('users/' + user.uid).remove();
        auth.currentUser.delete().then(() => location.reload());
    }
}
