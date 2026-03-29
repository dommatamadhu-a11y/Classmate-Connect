/**
 * Alumni Connect - Master Version 2024
 * Includes: Images, Likes, Comments, Search(4 Fields), Delete(Feed & Chat), Blocking, Reporting.
 */
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
let blockedList = [];

// --- 1. AUTH & USER INITIALIZATION ---
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

function loginWithGoogle() { auth.signInWithPopup(provider); }

function updateUI() {
    if(!user) return;
    document.getElementById('header-user-name').innerText = user.name;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('header-group-tag').innerText = user.inst ? "🎓 " + user.inst : "Edit Profile";
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.batch;
    document.getElementById('p-city').value = user.city;
}

// --- 2. FEED LOGIC (Post, Like, Comment, Delete, Report) ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('feedPhotoInput').files[0];
    if(!user.inst) return alert("Please setup your profile first!");
    if(!txt && !file) return;

    showToast("Sharing...");
    let b64 = file ? await toBase64(file) : "";
    db.ref('posts').push({
        uid: user.uid, name: user.name, msg: txt, img: b64, groupKey: user.groupKey,
        likes: 0, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
    document.getElementById('msgInput').value = "";
    document.getElementById('feedPhotoInput').value = "";
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(s => {
        const p = s.val();
        // Don't show posts from blocked users or outside group
        if(p.groupKey === user.groupKey && !blockedList.includes(p.uid)) {
            let id = s.key;
            let imgHtml = p.img ? `<img src="${p.img}" class="post-img">` : "";
            let options = p.uid === user.uid ? 
                `<span class="feed-options" onclick="deletePost('${id}')">🗑️</span>` : 
                `<span class="feed-options" onclick="reportContent('${id}', 'post')">🚩</span>`;
            
            cont.innerHTML = `
                <div class="card">
                    ${options}
                    <b>${p.name}</b> <small style="color:gray;">${p.time}</small>
                    <p>${p.msg}</p>${imgHtml}
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

function deletePost(id) { if(confirm("Delete this post?")) db.ref('posts/' + id).remove(); }
function likePost(id) { db.ref('posts/' + id + '/likes').transaction(c => (c || 0) + 1); }
function addComment(id) {
    let msg = prompt("Write comment:");
    if(msg) db.ref('comments/' + id).push({ name: user.name, msg: msg, uid: user.uid });
}
function loadComments(id) {
    db.ref('comments/' + id).limitToLast(5).on('value', snap => {
        const div = document.getElementById('comments-' + id); div.innerHTML = "";
        snap.forEach(s => {
            const c = s.val();
            if(!blockedList.includes(c.uid)) {
                div.innerHTML += `<div class="comment-box"><b>${c.name}:</b> ${c.msg}</div>`;
            }
        });
    });
}

// --- 3. CHAT LOGIC (Send, Photo, Delete, Block) ---
async function sendPhoto() {
    const file = document.getElementById('chatPhotoInput').files[0];
    if(file) {
        const b64 = await toBase64(file);
        const chatId = getChatId(user.uid, currentChatFriendUID);
        db.ref('private_messages/' + chatId).push({ sender: user.uid, img: b64 });
    }
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    const chatId = getChatId(user.uid, currentChatFriendUID);
    db.ref('private_messages/' + chatId).push({ sender: user.uid, text: msg });
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const chatId = getChatId(user.uid, currentChatFriendUID);
    
    // Check if I am blocked by them
    db.ref(`users/${currentChatFriendUID}/blocked/${user.uid}`).on('value', snap => {
        const inputArea = document.getElementById('chat-input-area');
        if(snap.exists()) {
            inputArea.innerHTML = "<p style='color:red; text-align:center; width:100%; font-size:12px;'>You cannot message this user.</p>";
        }
    });

    db.ref('private_messages/' + chatId).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            let body = m.img ? `<img src="${m.img}" class="chat-img">` : m.text;
            let del = m.sender === user.uid ? `<span class="delete-btn" onclick="deleteMsg('${chatId}','${s.key}')">Delete</span>` : "";
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${body}${del}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function deleteMsg(chatId, msgId) { if(confirm("Delete?")) db.ref('private_messages/' + chatId + '/' + msgId).remove(); }
function clearChat() { if(confirm("Clear conversation?")) db.ref('private_messages/' + getChatId(user.uid, currentChatFriendUID)).remove(); }

// --- 4. BLOCK & REPORT SYSTEM ---
function handleBlockToggle() {
    if(confirm("Block this user? You won't see their posts or chat.")) {
        db.ref(`users/${user.uid}/blocked/${currentChatFriendUID}`).set(true);
        closeChat();
        showToast("User Blocked");
    }
}

function unblockUser(targetUid) {
    db.ref(`users/${user.uid}/blocked/${targetUid}`).remove();
    showToast("User Unblocked");
}

function loadBlockedUsers() {
    const list = document.getElementById('blocked-users-list');
    list.innerHTML = "";
    blockedList.forEach(uid => {
        db.ref(`users/${uid}`).once('value', snap => {
            const u = snap.val();
            list.innerHTML += `<div style="display:flex; justify-content:space-between; padding:5px 0;">
                <span>${u?.name || 'User'}</span>
                <button onclick="unblockUser('${uid}')" style="color:blue; border:none; background:none; cursor:pointer;">Unblock</button>
            </div>`;
        });
    });
}

function reportContent(id, type) {
    const reason = prompt("Why are you reporting this?");
    if(reason) {
        db.ref('reports').push({ itemId: id, type: type, reporter: user.uid, reason: reason, time: Date.now() });
        showToast("Report submitted. We will review it.");
    }
}

// --- 5. SEARCH & FRIENDS (4 Fields) ---
function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    const year = document.getElementById('s-year').value;
    const city = document.getElementById('s-city').value.toUpperCase();
    const batch = document.getElementById('s-class').value.toUpperCase();
    const res = document.getElementById('my-friends-list');
    
    res.innerHTML = "Searching...";
    db.ref('users').once('value', snap => {
        res.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val();
            if(c.key === user.uid || blockedList.includes(c.key)) return;
            const match = (inst && u.inst?.toUpperCase().includes(inst)) || (year && u.year === year) || (city && u.city?.toUpperCase().includes(city)) || (batch && u.batch?.toUpperCase().includes(batch));
            if(match) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst || ''} (${u.year || ''})</small></div>
                    <button class="btn btn-blue" style="width:auto; padding:8px 15px;" onclick="addFriend('${c.key}', '${u.name}')">Connect</button>
                </div>`;
            }
        });
    });
}

function addFriend(fUid, fName) {
    db.ref('friends/' + user.uid + '/' + fUid).set({ name: fName });
    db.ref('friends/' + fUid + '/' + user.uid).set({ name: user.name });
    showToast("Friend Added! 🤝");
}

function loadMyFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>My Connections</h4>";
        snap.forEach(c => {
            if(!blockedList.includes(c.key)) {
                list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <b>${c.val().name}</b>
                    <button class="btn btn-blue" style="width:auto; padding:8px 15px;" onclick="openChat('${c.key}', '${c.val().name}')">Chat</button>
                </div>`;
            }
        });
    });
}

// --- 6. UTILS & NAVIGATION ---
function getChatId(u1, u2) { return u1 < u2 ? `${u1}_${u2}` : `${u2}_${u1}`; }

function toBase64(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => res(reader.result);
    });
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
    db.ref('users/' + user.uid).update({
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        batch: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value
    }).then(() => showToast("Profile Updated! ✅"));
}

function openChat(uid, name) {
    currentChatFriendUID = uid;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.className = "show"; setTimeout(() => t.className = "", 3000); }
function logout() { auth.signOut().then(() => location.reload()); }
function deleteAccount() { if(confirm("Delete account?")) { db.ref('users/' + user.uid).remove(); auth.currentUser.delete().then(() => location.reload()); } }
