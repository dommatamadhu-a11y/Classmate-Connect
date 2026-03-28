const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || null;
let currentChatFriend = "";

window.onload = () => {
    updateHeaderUI();
    if(user && user.name) {
        document.getElementById('p-name').value = user.name;
        document.getElementById('p-inst').value = user.inst;
        document.getElementById('p-year').value = user.year;
        listenToRequests();
        listenForChatNotifications();
    }
};

function updateHeaderUI() {
    if(user) {
        document.getElementById('header-user-name').innerText = "👤 " + user.name;
        document.getElementById('header-group-tag').innerText = "🎓 " + user.inst;
    }
}

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

function previewFile(inputId, imgId, containerId = null) {
    const file = document.getElementById(inputId).files[0];
    const preview = document.getElementById(imgId);
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = "block";
            if(containerId) document.getElementById(containerId).style.display = "block";
        };
        reader.readAsDataURL(file);
    }
}

function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    if(!name || !inst || !year) return alert("All fields are required!");
    const groupKey = `${inst}_${year}`.replace(/\s+/g, '').toUpperCase();
    user = { name, inst, year, groupKey };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user).then(() => location.reload());
}

// --- FEED LOGIC ---
function handleFeedPost() {
    const text = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('imageInput').files[0];
    const btn = document.getElementById('postBtn');

    if(!user) return alert("Login first!");
    if(!text && !file) return alert("Nothing to post!");

    btn.disabled = true; btn.innerText = "Posting...";

    if(file) {
        const reader = new FileReader();
        reader.onload = () => savePostToDB(text, reader.result);
        reader.readAsDataURL(file);
    } else savePostToDB(text, null);
}

function savePostToDB(msg, imageUrl) {
    db.ref('posts').push({
        name: user.name, msg, imageUrl, groupKey: user.groupKey,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    }).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('imageInput').value = "";
        document.getElementById('imagePreview').style.display = "none";
        document.getElementById('postBtn').disabled = false;
        document.getElementById('postBtn').innerText = "Post to Wall";
    });
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(user && p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" onclick="db.ref('posts/${c.key}').remove()">Delete</button>` : "";
            let img = p.imageUrl ? `<img src="${p.imageUrl}" class="feed-img">` : "";
            cont.innerHTML = `<div class="card" style="border-left:4px solid var(--primary);">${del}<b>${p.name}</b><p>${p.msg || ""}</p>${img}<small>${p.time}</small></div>` + cont.innerHTML;
        }
    });
});

// --- CHAT LOGIC ---
function openChat(friend) {
    currentChatFriend = friend;
    document.getElementById('chat-with-name').innerText = friend;
    document.getElementById('chat-window').style.display = "flex";
    db.ref('chat_notifications/' + user.name + '/' + friend).remove();
    loadMessages();
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }

function cancelChatImage() {
    document.getElementById('chatImageInput').value = "";
    document.getElementById('chatPreviewContainer').style.display = "none";
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    const file = document.getElementById('chatImageInput').files[0];
    if(!msg && !file) return;

    if(file) {
        const reader = new FileReader();
        reader.onload = () => pushMsg(msg, reader.result);
        reader.readAsDataURL(file);
    } else pushMsg(msg, null);
}

function pushMsg(text, imageUrl) {
    const chatId = user.name < currentChatFriend ? `${user.name}_${currentChatFriend}` : `${currentChatFriend}_${user.name}`;
    db.ref('private_messages/' + chatId).push({
        sender: user.name, text, imageUrl, 
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    });
    db.ref('chat_notifications/' + currentChatFriend + '/' + user.name).set(true);
    document.getElementById('privateMsgInput').value = "";
    cancelChatImage();
}

function loadMessages() {
    const chatId = user.name < currentChatFriend ? `${user.name}_${currentChatFriend}` : `${currentChatFriend}_${user.name}`;
    db.ref('private_messages/' + chatId).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            let img = m.imageUrl ? `<img src="${m.imageUrl}" style="width:100%; border-radius:10px; margin-bottom:5px;">` : "";
            cont.innerHTML += `<div class="msg-bubble ${m.sender===user.name?'mine':'theirs'}">${img}${m.text || ""}<div style="font-size:8px; opacity:0.6; margin-top:4px;">${m.time}</div></div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

// --- FRIENDS & SYSTEM ---
function searchAlumni() {
    const inst = document.getElementById('s-inst').value.trim().toUpperCase();
    const year = document.getElementById('s-year').value.trim();
    const res = document.getElementById('search-results'); res.innerHTML = "Searching...";
    db.ref('users').once('value', snap => {
        res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if(u.name !== user.name && (u.inst.toUpperCase() === inst || u.year === year)) {
                db.ref('friends/' + user.name + '/' + u.name).once('value', f => {
                    let btn = f.exists() ? `<button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="openChat('${u.name}')">Message</button>` : `<button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="sendRequest('${u.name}')">Add</button>`;
                    res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${u.name}</b>${btn}</div>`;
                });
            }
        });
    });
}

function sendRequest(t) { db.ref('requests/' + t + '/' + user.name).set({from: user.name}); alert("Sent!"); }

function listenToRequests() {
    db.ref('requests/' + user.name).on('value', snap => {
        const area = document.getElementById('notifications-area');
        area.style.display = snap.exists() ? "block" : "none";
        document.getElementById('notif-dot').style.display = snap.exists() ? "block" : "none";
        document.getElementById('request-list').innerHTML = "";
        snap.forEach(c => {
            document.getElementById('request-list').innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><span><b>${c.key}</b></span><button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="accept('${c.key}')">Accept</button></div>`;
        });
    });
}

function accept(n) { db.ref('friends/'+user.name+'/'+n).set(true); db.ref('friends/'+n+'/'+user.name).set(true); db.ref('requests/'+user.name+'/'+n).remove(); }

function loadMyFriends() {
    db.ref('friends/' + user.name).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>My Friends</h4>";
        snap.forEach(c => list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${c.key}</b><button class="btn btn-blue" style="width:auto; border-radius:20px;" onclick="openChat('${c.key}')">Chat</button></div>`);
    });
}

function listenForChatNotifications() {
    db.ref('chat_notifications/' + user.name).on('value', snap => {
        document.getElementById('notif-dot').style.display = snap.exists() ? "block" : "none";
    });
}

function logout() { localStorage.clear(); location.reload(); }
