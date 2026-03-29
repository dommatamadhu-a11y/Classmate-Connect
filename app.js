// Firebase Configuration
const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";

// Monitor Authentication State
auth.onAuthStateChanged((u) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (u) {
        // User is logged in
        loginOverlay.style.display = "none";
        
        db.ref('users/' + u.uid).on('value', snap => {
            const data = snap.val();
            user = {
                uid: u.uid,
                name: u.displayName,
                email: u.email,
                photo: u.photoURL,
                inst: data ? data.inst : "",
                year: data ? data.year : "",
                groupKey: data ? (data.inst + data.year).replace(/\s+/g,'').toUpperCase() : ""
            };
            updateUI();
            trackOnlineStatus();
        });
    } else {
        // User is not logged in - Show Login Screen
        loginOverlay.style.display = "flex";
    }
});

function loginWithGoogle() {
    auth.signInWithPopup(provider).catch(err => {
        alert("Login Error: " + err.message);
    });
}

function updateUI() {
    if(!user) return;
    document.getElementById('header-user-name').innerText = user.name;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('header-group-tag').innerText = user.inst ? "🎓 " + user.inst : "Setup Profile";
    
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-email-display').innerText = user.email;
    document.getElementById('p-inst').value = user.inst || "";
    document.getElementById('p-year').value = user.year || "";
}

function showToast(msg) {
    const x = document.getElementById("toast");
    x.innerText = msg;
    x.className = "show";
    setTimeout(() => x.className = "", 3000);
}

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

function saveProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();

    if(!inst || !year) return alert("Fill Institution & Year");

    db.ref('users/' + user.uid).update({
        inst, year, name: user.name, photo: user.photo
    }).then(() => {
        showToast("Profile Updated!");
    });
}

// FEED LOGIC
function handleFeedPost() {
    const text = document.getElementById('msgInput').value.trim();
    if(!user.inst) return alert("Update profile first!");
    if(!text) return;

    db.ref('posts').push({
        uid: user.uid,
        name: user.name,
        photo: user.photo,
        msg: text,
        groupKey: user.groupKey,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    }).then(() => {
        document.getElementById('msgInput').value = "";
        showToast("Memory Shared!");
    });
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); 
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(user && p.groupKey === user.groupKey) {
            cont.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.photo}" style="width:30px; height:30px; border-radius:50%;">
                        <b>${p.name}</b> <small style="color:gray;">${p.time}</small>
                    </div>
                    <p>${p.msg}</p>
                </div>` + cont.innerHTML;
        }
    });
});

// FRIENDS LOGIC
function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    const year = document.getElementById('s-year').value;
    const res = document.getElementById('my-friends-list');
    res.innerHTML = "Searching...";

    db.ref('users').once('value', snap => {
        res.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val();
            const uid = c.key;
            if(uid !== user.uid && (u.inst?.toUpperCase().includes(inst) || u.year === year)) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <b>${u.name}</b>
                    <button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="addFriend('${uid}', '${u.name}')">Connect</button>
                </div>`;
            }
        });
    });
}

function addFriend(fUid, fName) {
    db.ref('friends/' + user.uid + '/' + fUid).set({ name: fName });
    db.ref('friends/' + fUid + '/' + user.uid).set({ name: user.name });
    showToast("Connected with " + fName);
}

function loadMyFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const l = document.getElementById('my-friends-list'); l.innerHTML = "<h4>Connections</h4>";
        snap.forEach(c => {
            const fUid = c.key; const fData = c.val();
            l.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <b>${fData.name} <span id="st-${fUid}" style="font-size:10px;"></span></b>
                <button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="openChat('${fUid}', '${fData.name}')">Chat</button>
            </div>`;
            db.ref('status/' + fUid).on('value', s => {
                const el = document.getElementById('st-'+fUid);
                if(el) el.innerText = (s.val()?.state === 'online') ? "● Online" : "";
                if(el) el.style.color = "#2ec4b6";
            });
        });
    });
}

// CHAT & STATUS
function trackOnlineStatus() {
    const sRef = db.ref('status/' + user.uid);
    db.ref('.info/connected').on('value', snap => {
        if(!snap.val()) return;
        sRef.onDisconnect().set({ state: 'offline' }).then(() => sRef.set({ state: 'online' }));
    });
}

function openChat(fUid, fName) {
    currentChatFriendUID = fUid;
    document.getElementById('chat-with-name').innerText = fName;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
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
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function logout() { auth.signOut().then(() => location.reload()); }
