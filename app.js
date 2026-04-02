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
let blockedUsers = [];

function notify(msg) {
    const t = document.getElementById("toast");
    t.innerText = msg; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
}

auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { uid: u.uid, name: u.displayName, photo: d?.photo || u.photoURL, inst: d?.inst||"", city: d?.city||"", uClass: d?.uClass||"", year: d?.year||"" };
            blockedUsers = d?.blocked || [];
            updateUI(); loadFeed(); listenForRequests(); listenForMessages();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function updateUI() {
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-year').value = user.year;
}

// --- PRIVATE CHAT IMAGES & DELETE ---
function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim();
    if(!txt) return;
    pushMessage({ type: 'text', content: txt });
    document.getElementById('privateMsgInput').value = "";
}

async function sendChatImage() {
    const file = document.getElementById('chatImageInput').files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        pushMessage({ type: 'image', content: e.target.result });
    };
    reader.readAsDataURL(file);
}

function pushMessage(msgObj) {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/' + cid).push({
        sender: user.uid,
        type: msgObj.type,
        content: msgObj.content,
        time: Date.now()
    });
}

function deleteMessage(msgId) {
    if(confirm("Delete this message for everyone?")) {
        const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
        db.ref(`private_messages/${cid}/${msgId}`).remove()
        .then(() => notify("Message Deleted"));
    }
}

function openChat(uid, name) {
    currentChatFriendUID = uid;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    updateChatUI();
    const cid = user.uid < uid ? user.uid+'_'+uid : uid+'_'+user.uid;
    db.ref('private_messages/' + cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            if(blockedUsers.includes(m.sender)) return;
            
            const isMine = m.sender === user.uid;
            let contentHTML = m.type === 'image' ? `<img src="${m.content}" class="chat-img">` : m.content;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = `msg-bubble ${isMine ? 'mine' : 'theirs'}`;
            msgDiv.innerHTML = contentHTML;
            
            // Delete option for my own messages
            if(isMine) {
                msgDiv.onclick = () => deleteMessage(s.key);
            }
            
            c.appendChild(msgDiv);
        });
        c.scrollTop = c.scrollHeight;
    });
}

// --- OTHER FEATURES ---
function toggleBlock() {
    if(blockedUsers.includes(currentChatFriendUID)) {
        blockedUsers = blockedUsers.filter(id => id !== currentChatFriendUID);
    } else {
        if(confirm("Block this user?")) blockedUsers.push(currentChatFriendUID);
    }
    db.ref('users/' + user.uid + '/blocked').set(blockedUsers);
    updateChatUI();
}

function updateChatUI() {
    const isBlocked = blockedUsers.includes(currentChatFriendUID);
    document.getElementById('chat-input-area').style.display = isBlocked ? "none" : "flex";
    document.getElementById('blocked-msg').style.display = isBlocked ? "block" : "none";
    document.getElementById('block-btn').innerText = isBlocked ? "Unblock" : "Block";
}

function saveProfile() {
    const d = { inst: document.getElementById('p-inst').value, city: document.getElementById('p-city').value, uClass: document.getElementById('p-class').value, year: document.getElementById('p-year').value };
    db.ref('users/' + user.uid).update(d).then(() => notify("Profile Saved!"));
}

async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!txt || !user.inst) return notify("Complete profile first.");
    const key = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, time: Date.now(), filterKey: key })
    .then(() => { notify("Posted!"); document.getElementById('msgInput').value = ""; });
}

function loadFeed() {
    const key = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => { if(s.val().filterKey === key) cont.innerHTML = `<div class="card"><b>${s.val().name}</b><p>${s.val().msg}</p></div>` + cont.innerHTML; });
    });
}

function searchClassmates() {
    const s = document.getElementById('s-inst').value.toUpperCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            if(c.key !== user.uid && c.val().inst?.toUpperCase().includes(s)) {
                res.innerHTML += `<div class="card" onclick="connect('${c.key}','${c.val().name}')"><b>${c.val().name}</b><br><small>${c.val().inst}</small></div>`;
            }
        });
    });
}

function connect(uid, name) {
    db.ref('friends/'+user.uid+'/'+uid).once('value', s => {
        if(s.exists()) openChat(uid, name);
        else db.ref('friend_requests/'+uid+'/'+user.uid).set({ fromName: user.name }).then(() => notify("Request Sent!"));
    });
}

function listenForRequests() {
    db.ref('friend_requests/'+user.uid).on('value', snap => {
        const dot = document.getElementById('request-dot');
        if(snap.exists()) {
            dot.style.display = "block";
            const list = document.getElementById('requests-list'); list.innerHTML = "";
            snap.forEach(s => { list.innerHTML += `<div>${s.val().fromName} <button onclick="accept('${s.key}','${s.val().fromName}')">Accept</button></div>`; });
            document.getElementById('requests-section').style.display = "block";
        } else { dot.style.display = "none"; document.getElementById('requests-section').style.display = "none"; }
    });
}

function accept(fid, name) {
    db.ref('friends/'+user.uid+'/'+fid).set(true); db.ref('friends/'+fid+'/'+user.uid).set(true);
    db.ref('friend_requests/'+user.uid+'/'+fid).remove().then(() => notify("Connected!"));
}

function listenForMessages() {
    db.ref('friends/' + user.uid).on('child_added', snap => {
        const fid = snap.key;
        const cid = user.uid < fid ? user.uid+'_'+fid : fid+'_'+user.uid;
        db.ref('private_messages/' + cid).limitToLast(1).on('child_added', m => {
            if(m.val().sender !== user.uid && !blockedUsers.includes(m.val().sender) && (Date.now() - m.val().time < 3000)) notify("New Message!");
        });
    });
}

function inviteFriends() { window.open(`https://wa.me/?text=Join Classmate Connect: ${window.location.href}`, '_blank'); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function show(id, e, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav');
}
function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
