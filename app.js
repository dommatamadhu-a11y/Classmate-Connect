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
let isChatOpen = false;

// --- NOTIFICATIONS ---
function enableNotifications() {
    Notification.requestPermission().then(perm => {
        if (perm === "granted") {
            document.getElementById('noti-banner').style.display = 'none';
            showToast("Notifications enabled!");
        }
    });
}
if (Notification.permission === "default") document.getElementById('noti-banner').style.display = 'block';

function sendNotify(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, { body: body, icon: "logo.png" });
    }
}

// --- AUTH ---
function loginWithGoogle() { 
    auth.signInWithPopup(provider).catch(e => alert(e.message)); 
}

auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = {
                uid: u.uid, name: u.displayName, photo: u.photoURL,
                inst: d?.inst || "", year: d?.year || "", groupKey: d ? (d.inst + d.year).replace(/\s+/g,'').toUpperCase() : ""
            };
            updateUI(d);
            listenForChatNotifications(); // Listen for messages
        });
    } else {
        document.getElementById('login-overlay').style.display = "flex";
    }
});

function updateUI(d) {
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    if(d) {
        document.getElementById('p-inst').value = d.inst || "";
        document.getElementById('p-year').value = d.year || "";
        document.getElementById('p-class').value = d.batch || "";
        document.getElementById('p-city').value = d.city || "";
    }
}

// --- FEED & LIKE ANIMATION ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!user.inst) return alert("Fill profile first!");
    if(!txt) return;
    db.ref('posts').push({
        uid: user.uid, name: user.name, msg: txt, groupKey: user.groupKey,
        likes: 0, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    });
    document.getElementById('msgInput').value = "";
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(s => {
        const p = s.val();
        if(p.groupKey === user.groupKey) {
            let id = s.key;
            cont.innerHTML = `
                <div class="card">
                    <div style="font-size:13px; font-weight:600;">${p.name}</div>
                    <p style="font-size:14px; margin:8px 0;">${p.msg}</p>
                    <div style="font-size:18px; cursor:pointer;" onclick="likePost('${id}', this)">
                        <span class="like-btn-anim">❤️</span> <small style="font-size:12px;">${p.likes || 0}</small>
                    </div>
                </div>` + cont.innerHTML;
        }
    });
});

function likePost(id, el) {
    db.ref('posts/'+id+'/likes').transaction(c => (c || 0) + 1);
    const heart = el.querySelector('.like-btn-anim');
    heart.classList.add('active-heart');
    setTimeout(() => heart.classList.remove('active-heart'), 400);
}

// --- REAL-TIME CHAT & NOTIFICATIONS ---
function listenForChatNotifications() {
    // Listen for any new messages sent to this user
    db.ref('friends/' + user.uid).once('value', snap => {
        snap.forEach(friend => {
            const chatId = user.uid < friend.key ? user.uid+'_'+friend.key : friend.key+'_'+user.uid;
            db.ref('private_messages/' + chatId).limitToLast(1).on('child_added', mSnap => {
                const msg = mSnap.val();
                // Notify if: Message is from friend AND chat is NOT open with them AND it's a recent message
                if (msg.sender !== user.uid && (!isChatOpen || currentChatFriendUID !== msg.sender)) {
                    sendNotify("New Message", msg.text);
                }
            });
        });
    });
}

function openChat(uid, name) {
    currentChatFriendUID = uid;
    isChatOpen = true;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
}

function closeChat() {
    isChatOpen = false;
    document.getElementById('chat-window').style.display = "none";
}

function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim();
    if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, text: txt, timestamp: Date.now() });
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

// --- SEARCH & OTHERS ---
function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    db.ref('users').once('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if(c.key !== user.uid && u.inst?.toUpperCase().includes(inst)) {
                list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <b>${u.name}</b>
                    <button class="btn btn-blue" style="width:auto; padding:5px 10px;" onclick="addFriend('${c.key}','${u.name}')">Connect</button>
                </div>`;
            }
        });
    });
}

function addFriend(uid, name) {
    db.ref('friends/'+user.uid+'/'+uid).set({name: name});
    db.ref('friends/'+uid+'/'+user.uid).set({name: user.name});
    showToast("Connected!");
}

function loadMyFriends() {
    db.ref('friends/'+user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>Friends</h4>";
        snap.forEach(c => {
            list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between;">
                <b>${c.val().name}</b>
                <button class="btn btn-blue" style="width:auto; padding:5px 10px;" onclick="openChat('${c.key}','${c.val().name}')">Chat</button>
            </div>`;
        });
    });
}

function saveProfile() {
    db.ref('users/'+user.uid).update({
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        batch: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value
    }).then(() => showToast("Profile Saved!"));
}

function show(id, t, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}
function logout() { auth.signOut().then(() => location.reload()); }
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.className = "show"; setTimeout(() => t.className = "", 3000); }
