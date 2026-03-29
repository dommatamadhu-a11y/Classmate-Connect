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

// Setting persistence to LOCAL so login stays active
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

let user = null;
let currentChatFriendUID = "";
let blockedList = [];

// --- LOGIN FUNCTION (Back to Popup for Browser Support) ---
function loginWithGoogle() {
    auth.signInWithPopup(provider).then((result) => {
        console.log("Login Successful");
    }).catch((error) => {
        console.error("Login Error:", error.message);
        // If popup fails (like in some apps), try redirect as fallback
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
            auth.signInWithRedirect(provider);
        } else {
            alert("Error: " + error.message);
        }
    });
}

// Check for redirect result if popup was blocked
auth.getRedirectResult().catch(err => console.log(err.message));

auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = {
                uid: u.uid, name: u.displayName, photo: u.photoURL,
                inst: d?.inst || "", year: d?.year || "", city: d?.city || "", batch: d?.batch || "",
                groupKey: d ? (d.inst + d.year).replace(/\s+/g,'').toUpperCase() : ""
            };
            blockedList = d?.blocked ? Object.keys(d.blocked) : [];
            updateUI();
            loadBlockedUsers();
        });
    } else {
        document.getElementById('login-overlay').style.display = "flex";
    }
});

// --- UI & OTHER FEATURES (English) ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}
if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');

function updateUI() {
    if(!user) return;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.batch;
    document.getElementById('p-city').value = user.city;
}

async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('feedPhotoInput').files[0];
    if(!user.inst) return alert("Update profile first!");
    if(!txt && !file) return;
    showToast("Sharing...");
    let b64 = file ? await toBase64(file) : "";
    db.ref('posts').push({
        uid: user.uid, name: user.name, msg: txt, img: b64, groupKey: user.groupKey,
        likes: 0, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    });
    document.getElementById('msgInput').value = "";
    document.getElementById('feedPhotoInput').value = "";
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(s => {
        const p = s.val();
        if(p.groupKey === user.groupKey && !blockedList.includes(p.uid)) {
            let id = s.key;
            let imgTag = p.img ? `<img src="${p.img}" class="post-img">` : "";
            let action = p.uid === user.uid ? `<span class="options-btn" onclick="deletePost('${id}')">🗑️ Delete</span>` : `<span class="options-btn" onclick="reportContent('${id}')">🚩 Report</span>`;
            cont.innerHTML = `
                <div class="card">
                    ${action}
                    <div style="font-size:14px; font-weight:600;">${p.name} <small style="color:var(--sub); font-weight:400;">• ${p.time}</small></div>
                    <p style="font-size:14px; margin:10px 0;">${p.msg}</p>${imgTag}
                    <div class="action-bar">
                        <span class="action-item" onclick="likePost('${id}')">❤️ ${p.likes || 0}</span>
                        <span class="action-item" onclick="addComment('${id}')">💬 Comment</span>
                    </div>
                    <div id="comments-${id}"></div>
                </div>` + cont.innerHTML;
            loadComments(id);
        }
    });
});

function deletePost(id) { if(confirm("Delete?")) db.ref('posts/' + id).remove(); }
function likePost(id) { db.ref('posts/' + id + '/likes').transaction(c => (c || 0) + 1); }
function addComment(id) {
    let m = prompt("Comment:");
    if(m) db.ref('comments/' + id).push({ name: user.name, msg: m, uid: user.uid });
}
function loadComments(id) {
    db.ref('comments/' + id).limitToLast(3).on('value', snap => {
        const d = document.getElementById('comments-' + id); d.innerHTML = "";
        snap.forEach(s => { if(!blockedList.includes(s.val().uid)) d.innerHTML += `<div style="font-size:12px; margin-top:5px; color:var(--sub);"><b>${s.val().name}:</b> ${s.val().msg}</div>`; });
    });
}

function getChatId(u1, u2) { return u1 < u2 ? `${u1}_${u2}` : `${u2}_${u1}`; }
async function sendPhoto() {
    const file = document.getElementById('chatPhotoInput').files[0];
    if(file) {
        const b64 = await toBase64(file);
        db.ref('private_messages/' + getChatId(user.uid, currentChatFriendUID)).push({ sender: user.uid, img: b64 });
    }
}
function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    db.ref('private_messages/' + getChatId(user.uid, currentChatFriendUID)).push({ sender: user.uid, text: msg });
    document.getElementById('privateMsgInput').value = "";
}
function loadMessages() {
    const chatId = getChatId(user.uid, currentChatFriendUID);
    db.ref('private_messages/' + chatId).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            let body = m.img ? `<img src="${m.img}" style="width:100%; border-radius:10px;">` : m.text;
            let del = m.sender === user.uid ? `<span class="del-chat" onclick="deleteMsg('${chatId}','${s.key}')">Delete</span>` : "";
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${body}${del}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}
function deleteMsg(cid, mid) { if(confirm("Delete?")) db.ref('private_messages/'+cid+'/'+mid).remove(); }

function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    const year = document.getElementById('s-year').value;
    const city = document.getElementById('s-city').value.toUpperCase();
    const batch = document.getElementById('s-class').value.toUpperCase();
    const res = document.getElementById('my-friends-list');
    res.innerHTML = "Searching...";
    db.ref('users').once('value', snap => {
        res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if(c.key !== user.uid && !blockedList.includes(c.key)) {
                const match = (inst && u.inst?.toUpperCase().includes(inst)) || (year && u.year === year) || (city && u.city?.toUpperCase().includes(city)) || (batch && u.batch?.toUpperCase().includes(batch));
                if(match) res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><div><b>${u.name}</b><br><small>${u.inst}</small></div><button class="btn btn-blue" style="width:auto; padding:5px 12px;" onclick="addFriend('${c.key}','${u.name}')">Connect</button></div>`;
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
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>My Connections</h4>";
        snap.forEach(c => {
            if(!blockedList.includes(c.key)) list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${c.val().name}</b><button class="btn btn-blue" style="width:auto; padding:5px 12px;" onclick="openChat('${c.key}','${c.val().name}')">Chat</button></div>`;
        });
    });
}
function handleBlockToggle() {
    if(confirm("Block?")) { db.ref(`users/${user.uid}/blocked/${currentChatFriendUID}`).set(true); closeChat(); showToast("Blocked"); }
}
function loadBlockedUsers() {
    const list = document.getElementById('blocked-users-list'); list.innerHTML = "";
    blockedList.forEach(uid => {
        db.ref('users/'+uid).once('value', s => {
            if(s.exists()) list.innerHTML += `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid var(--border);"><span>${s.val().name}</span><button class="btn" style="color:var(--primary); padding:0;" onclick="unblock('${uid}')">Unblock</button></div>`;
        });
    });
}
function unblock(uid) { db.ref(`users/${user.uid}/blocked/${uid}`).remove(); }
function reportContent(id) { prompt("Reason?"); showToast("Reported."); }

function toBase64(file) { return new Promise(res => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result); }); }
function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}
function saveProfile() {
    db.ref('users/' + user.uid).update({
        inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value,
        batch: document.getElementById('p-class').value, city: document.getElementById('p-city').value
    }).then(() => showToast("Saved!"));
}
function openChat(uid, name) { currentChatFriendUID = uid; document.getElementById('chat-with-name').innerText = name; document.getElementById('chat-window').style.display = "flex"; loadMessages(); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.className = "show"; setTimeout(() => t.className = "", 3000); }
function logout() { auth.signOut().then(() => location.reload()); }
function deleteAccount() { if(confirm("Delete?")) { db.ref('users/'+user.uid).remove(); auth.currentUser.delete().then(()=>location.reload()); } }
