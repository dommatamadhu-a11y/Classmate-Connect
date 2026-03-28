const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || { name: "" };
let currentChatFriend = "";

window.onload = () => {
    updateHeader();
    if(user.name) {
        document.getElementById('p-name').value = user.name;
        document.getElementById('p-inst').value = user.inst;
        document.getElementById('p-year').value = user.year;
        document.getElementById('p-city').value = user.city;
        listenToRequests();
        listenForChatNotifications();
    }
};

function updateHeader() {
    const nameLabel = document.getElementById('header-user-name');
    const groupLabel = document.getElementById('header-group-tag');
    if(user.name) {
        nameLabel.innerText = "👤 Login as: " + user.name;
        groupLabel.innerText = user.inst ? "🎓 " + user.inst : "No Group";
    }
}

function logout() {
    if(confirm("Logout?")) {
        localStorage.removeItem("alumniUser");
        location.reload();
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

function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const city = document.getElementById('p-city').value.trim();
    if(!name || !inst || !year) return alert("Fill details!");

    const groupKey = `${inst}_${year}_${city}`.replace(/\s+/g, '').toUpperCase();
    user = { name, inst, year, city, groupKey };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user);
    alert("Saved!");
    location.reload();
}

// Search
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
                    let btn = fSnap.exists() ? `<button class="btn btn-green" style="width:auto;" onclick="openChat('${u.name}')">Chat</button>` : `<button class="btn btn-blue" style="width:auto;" onclick="sendRequest('${u.name}')">Add</button>`;
                    resDiv.innerHTML += `<div class="card"><b>${u.name}</b><br>${btn}</div>`;
                });
            }
        });
    });
}

function sendRequest(target) {
    db.ref('requests/' + target + '/' + user.name).set({ from: user.name });
    alert("Sent!");
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
                list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${c.key}</span><button onclick="accept('${c.key}')">Accept</button></div>`;
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
            list.innerHTML += `<div class="card"><b>${c.key}</b><button class="btn btn-green" style="float:right; width:auto;" onclick="openChat('${c.key}')">Chat</button></div>`;
        });
    });
}

// Chat
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
            container.innerHTML += `<div class="msg-bubble" style="align-self:${isMine?'flex-end':'flex-start'}; background:${isMine?'#dcf8c6':'white'};">${m.text}</div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// Feed
function sendPost() {
    const msg = document.getElementById('msgInput').value;
    if(msg && user.groupKey) {
        db.ref('posts').push({ name: user.name, msg, groupKey: user.groupKey, time: new Date().toLocaleTimeString() });
        document.getElementById('msgInput').value = "";
    }
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container');
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" onclick="db.ref('posts/${c.key}').remove()">Delete</button>` : "";
            cont.innerHTML = `<div class="card">${del}<b>${p.name}</b><br><p>${p.msg}</p><small>${p.time}</small></div>` + cont.innerHTML;
        }
    });
});
