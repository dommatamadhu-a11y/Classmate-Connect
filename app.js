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
let isChatOpen = false;
let currentChatFriendUID = "";
let blockedUsers = [];

// --- UTILS ---
function cleanString(str) { return str ? str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : ""; }

function formatTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return new Date(ts).toLocaleDateString();
}

async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- NOTIFICATIONS ---
function enableNotifications() {
    Notification.requestPermission().then(perm => { if (perm === "granted") { document.getElementById('noti-banner').style.display = 'none'; showToast("Notifications on!"); } });
}
function sendNotify(title, body) { if (Notification.permission === "granted") new Notification(title, { body: body, icon: "logo.png" }); }

// --- AUTH ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('blocks/' + u.uid).on('value', snap => {
            blockedUsers = [];
            snap.forEach(s => { blockedUsers.push(s.key); });
            if(user) loadFeed(); 
        });
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = {
                uid: u.uid, name: u.displayName, photo: u.photoURL,
                inst: d?.inst || "", year: d?.year || "", instCity: d?.instCity || "", group: d?.group || "",
                groupKey: d ? cleanString(d.inst) + d.year : ""
            };
            updateUI(d);
            listenForChatNotifications();
            loadFeed();
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
        document.getElementById('p-inst-city').value = d.instCity || "";
        document.getElementById('p-year').value = d.year || "";
        document.getElementById('p-group').value = d.group || "";
    }
}

// --- FEED LOGIC ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('feedPhotoInput').files[0];
    if(!user.inst || !user.year) return alert("Please finish your profile first!");
    if(!txt && !file) return;
    showToast("Posting...");
    let imgData = file ? await processImage(file) : "";
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, img: imgData, groupKey: user.groupKey, likes: 0, time: Date.now() });
    document.getElementById('msgInput').value = ""; document.getElementById('feedPhotoInput').value = "";
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        let hasPosts = false, posts = [];
        snap.forEach(s => { posts.push({id: s.key, ...s.val()}); });
        posts.reverse().forEach(p => {
            if(p.groupKey === user.groupKey && !blockedUsers.includes(p.uid)) {
                hasPosts = true;
                let imgTag = p.img ? `<img src="${p.img}" class="post-img" onclick="window.open('${p.img}')">` : "";
                let delBtn = p.uid === user.uid ? `<span class="action-btn" onclick="deletePost('${p.id}')">Delete</span>` : "";
                cont.innerHTML += `<div class="card">
                    <span class="action-btn" onclick="reportPost('${p.id}', '${p.msg}')">Report</span> ${delBtn}
                    <div style="font-size:13px; font-weight:600;">${p.name} <small style="font-weight:400; opacity:0.6; margin-left:5px;">${formatTime(p.time)}</small></div>
                    <p style="font-size:14px; margin:10px 0;">${p.msg}</p>${imgTag}
                    <div style="font-size:20px; cursor:pointer;" onclick="likePost('${p.id}', this)"><span>❤️</span> <small style="font-size:13px;">${p.likes || 0}</small></div>
                </div>`;
            }
        });
        if(!hasPosts) cont.innerHTML = `<div class="empty-state">No posts in your batch yet.</div>`;
    });
}

function deletePost(id) { if(confirm("Delete this post?")) db.ref('posts/'+id).remove(); }
function likePost(id, el) { db.ref('posts/'+id+'/likes').transaction(c => (c || 0) + 1); const h = el.querySelector('span'); h.classList.add('active-heart'); setTimeout(() => h.classList.remove('active-heart'), 500); }
function reportPost(id, msg) { if(confirm("Report this post?")) { db.ref('reports').push({ reporter: user.uid, postId: id, msg: msg, time: Date.now() }); showToast("Post reported."); } }

// --- CHAT LOGIC ---
function openChat(uid, name) { currentChatFriendUID = uid; isChatOpen = true; document.getElementById('chat-with-name').innerText = name; document.getElementById('chat-window').style.display = "flex"; loadMessages(); }
function closeChat() { isChatOpen = false; document.getElementById('chat-window').style.display = "none"; }
function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim();
    if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('privateMsgInput').value = "";
}
async function sendPhoto() {
    const file = document.getElementById('chatPhotoInput').files[0];
    if(file) {
        showToast("Sending...");
        const b = await processImage(file);
        const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
        db.ref('private_messages/'+cid).push({ sender: user.uid, img: b, time: Date.now() });
        document.getElementById('chatPhotoInput').value = "";
    }
}
function loadMessages() {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(), isMine = m.sender === user.uid;
            let content = m.text ? m.text : `<img src="${m.img}" class="chat-img" onclick="window.open('${m.img}')">`;
            c.innerHTML += `<div class="msg-bubble ${isMine?'mine':'theirs'}" onclick="${isMine ? `deleteChatMsg('${cid}','${s.key}')`:''}">
                ${content}<span class="msg-time">${new Date(m.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}
function deleteChatMsg(cid, mid) { if(confirm("Delete message?")) db.ref('private_messages/'+cid+'/'+mid).remove(); }
function blockCurrentChatUser() { if(confirm("Block user?")) { db.ref('blocks/' + user.uid + '/' + currentChatFriendUID).set(true); showToast("User blocked."); closeChat(); } }

function listenForChatNotifications() {
    db.ref('friends/' + user.uid).once('value', snap => {
        snap.forEach(f => {
            const cid = user.uid < f.key ? user.uid+'_'+f.key : f.key+'_'+user.uid;
            db.ref('private_messages/'+cid).limitToLast(1).on('child_added', mSnap => {
                const m = mSnap.val();
                if(m.sender !== user.uid && !blockedUsers.includes(m.sender) && (!isChatOpen || currentChatFriendUID !== m.sender)) {
                    sendNotify("New message from " + f.val().name, m.text || "Sent a photo");
                }
            });
        });
    });
}

// --- SEARCH WITH MULTIPLE FILTERS ---
function searchAlumni() {
    const sInst = cleanString(document.getElementById('s-inst').value);
    const sCity = cleanString(document.getElementById('s-inst-city').value);
    const sYear = document.getElementById('s-year').value;
    const sGroup = cleanString(document.getElementById('s-group').value);

    if(!sInst && !sCity && !sYear && !sGroup) return showToast("Enter at least one detail");

    db.ref('users').once('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>Search Results</h4>";
        let found = false;
        snap.forEach(c => {
            const u = c.val();
            if(c.key === user.uid) return;

            // Matching Logic
            const matchInst = !sInst || cleanString(u.inst).includes(sInst);
            const matchCity = !sCity || cleanString(u.instCity).includes(sCity);
            const matchYear = !sYear || u.year == sYear;
            const matchGroup = !sGroup || cleanString(u.group).includes(sGroup);

            if(matchInst && matchCity && matchYear && matchGroup) {
                found = true;
                list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst}, ${u.instCity || ''}<br>${u.year} - ${u.group || ''}</small></div>
                    <button class="btn btn-blue" style="width:auto; padding:8px 15px;" onclick="addFriend('${c.key}','${u.name}')">Connect</button>
                </div>`;
            }
        });
        if(!found) list.innerHTML += `<p style="text-align:center; font-size:12px; color:var(--sub);">No matches found.</p>`;
    });
}

function addFriend(uid, name) { db.ref('friends/'+user.uid+'/'+uid).set({name: name}); db.ref('friends/'+uid+'/'+user.uid).set({name: user.name}); showToast("Connected!"); }
function loadMyFriends() {
    db.ref('friends/'+user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>My Network</h4>";
        if(!snap.exists()) list.innerHTML += `<p style="font-size:12px; color:var(--sub);">Use search to connect with friends.</p>`;
        snap.forEach(c => { list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${c.val().name}</b><button class="btn btn-blue" style="width:auto; padding:8px 15px;" onclick="openChat('${c.key}','${c.val().name}')">Chat</button></div>`; });
    });
}

function saveProfile() {
    const inst = document.getElementById('p-inst').value, year = document.getElementById('p-year').value;
    if(!inst || !year) return alert("Institution and Year are required!");
    db.ref('users/'+user.uid).update({
        inst: inst, instCity: document.getElementById('p-inst-city').value,
        year: year, group: document.getElementById('p-group').value
    }).then(() => showToast("Profile Updated!"));
}

function show(id, t, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { if(confirm("Sign out?")) auth.signOut().then(() => location.reload()); }
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.className = "show"; setTimeout(() => t.className = "", 3000); }
