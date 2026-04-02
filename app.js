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

// --- AUTHENTICATION ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { uid: u.uid, name: u.displayName, photo: d?.photo || u.photoURL, inst: d?.inst||"", year: d?.year||"" };
            updateUI();
            loadFeed();
            listenForRequests();
        });
    } else {
        document.getElementById('login-overlay').style.display = "flex";
    }
});

function updateUI() {
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
}

// --- FEED WITH LIKES & COMMENTS ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!txt) return;
    const file = document.getElementById('feedPhotoInput').files[0];
    let imgData = "";
    if(file) {
        const reader = new FileReader();
        imgData = await new Promise(r => { reader.onload=e=>r(e.target.result); reader.readAsDataURL(file); });
    }
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, img: imgData, time: Date.now() });
    document.getElementById('msgInput').value = ""; document.getElementById('feedPhotoInput').value = "";
    showToast("Posted successfully!");
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            const likesCount = p.likes ? Object.keys(p.likes).length : 0;
            const isLiked = p.likes && p.likes[user.uid] ? 'liked' : '';
            
            cont.innerHTML += `
            <div class="card">
                <b>${p.name}</b><p>${p.msg}</p>
                ${p.img ? `<img src="${p.img}" class="post-img">`:''}
                <div class="post-actions">
                    <span class="action-btn ${isLiked}" onclick="toggleLike('${pid}')"><i class="${isLiked?'fas':'far'} fa-heart"></i> ${likesCount}</span>
                    <span class="action-btn" onclick="toggleComments('${pid}')"><i class="far fa-comment"></i> Comments</span>
                </div>
                <div id="comment-area-${pid}" class="comment-section">
                    <div id="list-${pid}"></div>
                    <div style="display:flex; gap:5px; margin-top:10px;">
                        <input type="text" id="in-${pid}" placeholder="Add comment..." style="margin-bottom:0; padding:8px;">
                        <button onclick="addComment('${pid}')" class="btn-blue" style="width:45px;"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>`;
            loadComments(pid);
        });
    });
}

function toggleLike(pid) {
    const ref = db.ref(`posts/${pid}/likes/${user.uid}`);
    ref.once('value', s => s.exists() ? ref.remove() : ref.set(true));
}

function toggleComments(pid) {
    const el = document.getElementById(`comment-area-${pid}`);
    el.style.display = el.style.display === "block" ? "none" : "block";
}

function addComment(pid) {
    const val = document.getElementById(`in-${pid}`).value.trim();
    if(!val) return;
    db.ref(`posts/${pid}/comments`).push({ name: user.name, text: val });
    document.getElementById(`in-${pid}`).value = "";
}

function loadComments(pid) {
    db.ref(`posts/${pid}/comments`).on('value', snap => {
        const list = document.getElementById(`list-${pid}`); if(!list) return;
        list.innerHTML = "";
        snap.forEach(s => { list.innerHTML += `<div class="comment-item"><b>${s.val().name}:</b> ${s.val().text}</div>`; });
    });
}

// --- NETWORK & FRIEND REQUESTS ---
function searchAlumni() {
    const sInst = document.getElementById('s-inst').value.toUpperCase();
    const sYear = document.getElementById('s-year').value;
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if((u.inst && u.inst.toUpperCase().includes(sInst)) || u.year == sYear) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst}</small></div>
                    <button class="btn-blue" style="width:auto; padding:8px 15px;" onclick="checkAndChat('${c.key}','${u.name}')">Chat / Add</button>
                </div>`;
            }
        });
    });
}

function checkAndChat(uid, name) {
    db.ref('friends/' + user.uid + '/' + uid).once('value', s => {
        if(s.exists()) openChat(uid, name);
        else if(confirm("Send friend request to chat?")) db.ref('friend_requests/'+uid+'/'+user.uid).set({fromName: user.name});
    });
}

function listenForRequests() {
    db.ref('friend_requests/' + user.uid).on('value', snap => {
        const list = document.getElementById('requests-list');
        const dot = document.getElementById('request-dot');
        list.innerHTML = "";
        if(snap.exists()){
            document.getElementById('requests-section').style.display = "block"; dot.style.display = "block";
            snap.forEach(s => {
                list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span><b>${s.val().fromName}</b></span>
                    <button class="btn-blue" style="width:auto; padding:5px 10px;" onclick="acceptFriend('${s.key}')">Accept</button>
                </div>`;
            });
        } else { document.getElementById('requests-section').style.display = "none"; dot.style.display = "none"; }
    });
}

function acceptFriend(fid) {
    db.ref('friends/'+user.uid+'/'+fid).set(true); db.ref('friends/'+fid+'/'+user.uid).set(true);
    db.ref('friend_requests/'+user.uid+'/'+fid).remove(); showToast("Connected!");
}

// --- CHAT ---
function openChat(uid, name) {
    currentChatFriendUID = uid; document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex"; loadMessages();
}

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
        snap.forEach(s => { c.innerHTML += `<div class="msg-bubble ${s.val().sender === user.uid?'mine':'theirs'}">${s.val().text}</div>`; });
        c.scrollTop = c.scrollHeight;
    });
}

// --- HELPERS ---
function show(id, event, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3000); }
function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function saveProfile() {
    db.ref('users/'+user.uid).update({ inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value })
    .then(() => showToast("Profile Updated!"));
}
