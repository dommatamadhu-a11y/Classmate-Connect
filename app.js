const firebaseConfig = { 
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || null;
let currentChatFriend = "";

window.onload = () => {
    updateHeaderUI();
    checkNotificationPermission(); // పర్మిషన్ చెక్ చేస్తుంది
    if(user && user.name) {
        document.getElementById('p-name').value = user.name;
        document.getElementById('p-inst').value = user.inst;
        document.getElementById('p-year').value = user.year;
        document.getElementById('p-city').value = user.city;
        listenToRequests();
        listenForChatNotifications();
        listenForIncomingMessages(); // కొత్త మెసేజ్ వస్తే నోటిఫికేషన్ కోసం
    }
};

// --- PUSH NOTIFICATION PERMISSION ---
function checkNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
        document.getElementById('notif-banner').style.display = "block";
    }
}

function requestNotificationPermission() {
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            document.getElementById('notif-banner').style.display = "none";
            alert("Notifications Enabled! 🎉");
        }
    });
}

// బ్రౌజర్ పైన నోటిఫికేషన్ చూపించే ఫంక్షన్
function showBrowserNotification(sender, text) {
    if (Notification.permission === "granted" && document.hidden) {
        new Notification("New Message from " + sender, {
            body: text,
            icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png"
        });
    }
}

function updateHeaderUI() {
    const nameLabel = document.getElementById('header-user-name');
    const groupLabel = document.getElementById('header-group-tag');
    if(user && user.name) {
        nameLabel.innerText = "👤 " + user.name;
        groupLabel.innerText = user.inst ? "🎓 " + user.inst : "Setup Profile";
    }
}

// --- LISTEN FOR REAL-TIME MESSAGE ALERTS ---
function listenForIncomingMessages() {
    db.ref('chat_notifications/' + user.name).on('child_added', snap => {
        const senderName = snap.key;
        // ఆ వ్యక్తితో చాట్ విండో ఓపెన్ లేకపోతేనే బ్రౌజర్ నోటిఫికేషన్ ఇస్తాం
        if (currentChatFriend !== senderName) {
            showBrowserNotification(senderName, "Sent you a message!");
        }
    });
}

function logout() {
    localStorage.clear();
    location.reload();
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
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const city = document.getElementById('p-city').value.trim();
    if(!name || !inst) return alert("Enter details!");
    const groupKey = `${inst}_${year}`.replace(/\s+/g, '').toUpperCase();
    user = { name, inst, year, city, groupKey };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user).then(() => { location.reload(); });
}

function searchAlumni() {
    const sInst = document.getElementById('s-inst').value.trim().toUpperCase();
    const sYear = document.getElementById('s-year').value.trim();
    const resDiv = document.getElementById('search-results');
    resDiv.innerHTML = "Searching...";
    db.ref('users').once('value', snap => {
        resDiv.innerHTML = "";
        snap.forEach(child => {
            const u = child.val();
            if(u.name !== user.name && (u.inst.toUpperCase() === sInst || u.year === sYear)) {
                db.ref('friends/' + user.name + '/' + u.name).once('value', fSnap => {
                    let btn = fSnap.exists() ? `<button class="btn btn-blue" style="width:auto;" onclick="openChat('${u.name}')">Message</button>` : `<button class="btn btn-blue" style="width:auto;" onclick="sendRequest('${u.name}')">Connect</button>`;
                    resDiv.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${u.name}</b>${btn}</div>`;
                });
            }
        });
    });
}

function sendRequest(target) {
    db.ref('requests/' + target + '/' + user.name).set({ from: user.name });
    alert("Request Sent!");
}

function listenToRequests() {
    db.ref('requests/' + user.name).on('value', snap => {
        const area = document.getElementById('notifications-area');
        const list = document.getElementById('request-list');
        list.innerHTML = "";
        if(snap.exists()) {
            area.style.display = "block";
            document.getElementById('notif-dot').style.display = "block";
            snap.forEach(c => {
                list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><span><b>${c.key}</b></span><button class="btn btn-blue" style="width:auto;" onclick="accept('${c.key}')">Accept</button></div>`;
            });
        } else area.style.display = "none";
    });
}

function accept(name) {
    db.ref('friends/' + user.name + '/' + name).set(true);
    db.ref('friends/' + name + '/' + user.name).set(true);
    db.ref('requests/' + user.name + '/' + name).remove();
}

function loadMyFriends() {
    const list = document.getElementById('my-friends-list');
    db.ref('friends/' + user.name).on('value', snap => {
        list.innerHTML = "";
        snap.forEach(c => {
            list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>👤 ${c.key}</b><button class="btn btn-blue" style="width:auto; border-radius:20px;" onclick="openChat('${c.key}')">Chat</button></div>`;
        });
    });
}

function openChat(friendName) {
    currentChatFriend = friendName;
    document.getElementById('chat-with-name').innerText = friendName;
    document.getElementById('chat-window').style.display = "block";
    db.ref('chat_notifications/' + user.name + '/' + friendName).remove();
    loadPrivateMessages();
}

function closeChat() { 
    document.getElementById('chat-window').style.display = "none"; 
    db.ref('private_messages/' + getChatId(user.name, currentChatFriend)).off();
}

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
    db.ref('chat_notifications/' + user.name).on('value', snap => {
        document.getElementById('notif-dot').style.display = snap.exists() ? "block" : "none";
    });
}

function loadPrivateMessages() {
    const container = document.getElementById('chat-messages');
    db.ref('private_messages/' + getChatId(user.name, currentChatFriend)).on('value', snap => {
        container.innerHTML = "";
        snap.forEach(c => {
            const m = c.val();
            const isMine = m.sender === user.name;
            container.innerHTML += `<div class="msg-bubble ${isMine?'mine':'theirs'}">${m.text}</div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

function sendPost() {
    const msg = document.getElementById('msgInput').value;
    if(msg && user.groupKey) {
        db.ref('posts').push({ name: user.name, msg, groupKey: user.groupKey, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
        document.getElementById('msgInput').value = "";
    }
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container');
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(user && p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" onclick="db.ref('posts/${c.key}').remove()">Delete</button>` : "";
            cont.innerHTML = `<div class="card" style="border-left: 4px solid var(--primary);">${del}<b>${p.name}</b><br><p>${p.msg}</p><small>${p.time}</small></div>` + cont.innerHTML;
        }
    });
});
