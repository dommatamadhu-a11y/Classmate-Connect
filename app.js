const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || null;
let currentChatFriend = "";

window.onload = () => {
    updateHeaderUI();
    checkNotificationPermission();
    if(user && user.name) {
        document.getElementById('p-name').value = user.name;
        document.getElementById('p-inst').value = user.inst;
        document.getElementById('p-year').value = user.year;
        document.getElementById('p-city').value = user.city;
        listenToRequests();
        listenForChatNotifications();
        listenForIncomingMessages();
    }
};

function checkNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        document.getElementById('notif-banner').style.display = "block";
    }
}

function requestNotificationPermission() {
    Notification.requestPermission().then(p => { if(p === "granted") document.getElementById('notif-banner').style.display = "none"; });
}

function showBrowserNotification(sender, text) {
    if (Notification.permission === "granted" && document.hidden) {
        new Notification("New Message from " + sender, { body: text });
    }
}

function updateHeaderUI() {
    const n = document.getElementById('header-user-name'), g = document.getElementById('header-group-tag');
    if(user && user.name) { n.innerText = "👤 " + user.name; g.innerText = "🎓 " + (user.inst || "Setup Profile"); }
}

function listenForIncomingMessages() {
    if(!user) return;
    db.ref('chat_notifications/' + user.name).on('child_added', snap => {
        if (currentChatFriend !== snap.key) showBrowserNotification(snap.key, "Sent a message");
    });
}

function logout() { if(confirm("Logout?")) { localStorage.clear(); location.reload(); } }

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

function saveProfile() {
    const name = document.getElementById('p-name').value.trim(), inst = document.getElementById('p-inst').value.trim(), year = document.getElementById('p-year').value.trim(), city = document.getElementById('p-city').value.trim();
    if(!name || !inst || !year) return alert("Fill required fields!");
    const groupKey = `${inst}_${year}`.replace(/\s+/g, '').toUpperCase();
    user = { name, inst, year, city, groupKey };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user).then(() => location.reload());
}

function searchAlumni() {
    const inst = document.getElementById('s-inst').value.trim().toUpperCase(), year = document.getElementById('s-year').value.trim(), res = document.getElementById('search-results');
    res.innerHTML = "Searching...";
    db.ref('users').once('value', snap => {
        res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if(u.name !== user.name && (u.inst.toUpperCase() === inst || u.year === year)) {
                db.ref('friends/' + user.name + '/' + u.name).once('value', f => {
                    let btn = f.exists() ? `<button class="btn btn-blue" style="width:auto;" onclick="openChat('${u.name}')">Message</button>` : `<button class="btn btn-blue" style="width:auto;" onclick="sendRequest('${u.name}')">Connect</button>`;
                    res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${u.name}</b>${btn}</div>`;
                });
            }
        });
    });
}

function sendRequest(t) { db.ref('requests/' + t + '/' + user.name).set({ from: user.name }); alert("Sent!"); }

function listenToRequests() {
    db.ref('requests/' + user.name).on('value', snap => {
        const area = document.getElementById('notifications-area'), list = document.getElementById('request-list');
        list.innerHTML = "";
        if(snap.exists()) {
            area.style.display = "block"; document.getElementById('notif-dot').style.display = "block";
            snap.forEach(c => list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span><b>${c.key}</b></span><button class="btn btn-blue" style="width:auto;" onclick="accept('${c.key}')">Accept</button></div>`);
        } else area.style.display = "none";
    });
}

function accept(n) { db.ref('friends/' + user.name + '/' + n).set(true); db.ref('friends/' + n + '/' + user.name).set(true); db.ref('requests/' + user.name + '/' + n).remove(); }

function loadMyFriends() {
    db.ref('friends/' + user.name).on('value', snap => {
        const l = document.getElementById('my-friends-list'); l.innerHTML = "";
        snap.forEach(c => l.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>👤 ${c.key}</b><button class="btn btn-blue" style="width:auto; border-radius:20px;" onclick="openChat('${c.key}')">Chat</button></div>`);
    });
}

function openChat(n) { currentChatFriend = n; document.getElementById('chat-with-name').innerText = n; document.getElementById('chat-window').style.display = "block"; db.ref('chat_notifications/' + user.name + '/' + n).remove(); loadPrivateMessages(); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; db.ref('private_messages/' + getChatId(user.name, currentChatFriend)).off(); }
function getChatId(u1, u2) { return u1 < u2 ? `${u1}_${u2}` : `${u2}_${u1}`; }

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(msg && currentChatFriend) {
        db.ref('private_messages/' + getChatId(user.name, currentChatFriend)).push({ sender: user.name, text: msg });
        db.ref('chat_notifications/' + currentChatFriend + '/' + user.name).set(true);
        document.getElementById('privateMsgInput').value = "";
    }
}

function listenForChatNotifications() {
    if(user) db.ref('chat_notifications/' + user.name).on('value', snap => document.getElementById('notif-dot').style.display = snap.exists() ? "block" : "none");
}

function loadPrivateMessages() {
    db.ref('private_messages/' + getChatId(user.name, currentChatFriend)).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => { const m = s.val(); c.innerHTML += `<div class="msg-bubble ${m.sender===user.name?'mine':'theirs'}">${m.text}</div>`; });
        c.scrollTop = c.scrollHeight;
    });
}

// --- IMAGE FEED LOGIC (FREE NO-STORAGE MODE) ---
function previewImage() {
    const file = document.getElementById('imageInput').files[0], preview = document.getElementById('imagePreview');
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.style.display = "block"; };
        reader.readAsDataURL(file);
    }
}

function handlePostSubmission() {
    const text = document.getElementById('msgInput').value.trim(), file = document.getElementById('imageInput').files[0], btn = document.getElementById('postBtn');
    if(!user || !user.groupKey) return alert("Setup profile first!");
    if(!text && !file) return alert("Empty post!");

    btn.disabled = true; btn.innerText = "Posting...";
    if(file) {
        const reader = new FileReader();
        reader.onload = () => savePostToDatabase(text, reader.result);
        reader.readAsDataURL(file);
    } else savePostToDatabase(text, null);
}

function savePostToDatabase(msg, imageUrl) {
    db.ref('posts').push({ name: user.name, msg, imageUrl, groupKey: user.groupKey, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) })
    .then(() => {
        document.getElementById('msgInput').value = ""; document.getElementById('imageInput').value = "";
        document.getElementById('imagePreview').style.display = "none";
        document.getElementById('postBtn').disabled = false; document.getElementById('postBtn').innerText = "Post to Wall";
    });
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(user && p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" onclick="db.ref('posts/${c.key}').remove()">Delete</button>` : "";
            let img = p.imageUrl ? `<img src="${p.imageUrl}" class="feed-img">` : "";
            cont.innerHTML = `<div class="card" style="border-left:4px solid var(--primary);">${del}<b>👤 ${p.name}</b><p>${p.msg || ""}</p>${img}<small>🕒 ${p.time}</small></div>` + cont.innerHTML;
        }
    });
});
