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
let blockedUsers = [];

// --- UTILS ---
function cleanString(str) { return str ? str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : ""; }
function formatTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return new Date(ts).toLocaleDateString();
}

async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800; let w = img.width, h = img.height;
                if (w > MAX) { h *= MAX / w; w = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- AUTH ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('blocks/' + u.uid).on('value', snap => {
            blockedUsers = []; snap.forEach(s => { blockedUsers.push(s.key); });
            if(user) loadFeed();
        });
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { uid: u.uid, name: u.displayName, photo: u.photoURL, inst: d?.inst||"", year: d?.year||"", groupKey: d?cleanString(d.inst)+d.year:"" };
            updateUI(d); loadFeed();
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
        document.getElementById('p-inst').value = d.inst||""; document.getElementById('p-inst-city').value = d.instCity||"";
        document.getElementById('p-year').value = d.year||""; document.getElementById('p-group').value = d.group||"";
    }
}

// --- FEED & POLLS ---
function togglePostType(type) {
    document.getElementById('msg-area').style.display = type === 'msg' ? 'block' : 'none';
    document.getElementById('poll-area').style.display = type === 'poll' ? 'block' : 'none';
    document.getElementById('tab-msg').style.color = type === 'msg' ? 'var(--primary)' : 'var(--sub)';
    document.getElementById('tab-poll').style.color = type === 'poll' ? 'var(--primary)' : 'var(--sub)';
}

async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('feedPhotoInput').files[0];
    if(!user.inst) return alert("Complete profile first!");
    let imgData = file ? await processImage(file) : "";
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, img: imgData, type: 'msg', groupKey: user.groupKey, time: Date.now(), likes: 0 });
    document.getElementById('msgInput').value = ""; document.getElementById('feedPhotoInput').value = "";
}

function handlePollPost() {
    const q = document.getElementById('pollQ').value.trim();
    const o1 = document.getElementById('opt1').value.trim();
    const o2 = document.getElementById('opt2').value.trim();
    if(!q || !o1 || !o2) return alert("Fill all poll fields!");
    db.ref('posts').push({
        uid: user.uid, name: user.name, question: q, 
        options: { opt1: {txt: o1, votes: 0}, opt2: {txt: o2, votes: 0} },
        type: 'poll', groupKey: user.groupKey, time: Date.now()
    });
    document.getElementById('pollQ').value = ""; document.getElementById('opt1').value = ""; document.getElementById('opt2').value = "";
    togglePostType('msg');
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        let posts = []; snap.forEach(s => { posts.push({id: s.key, ...s.val()}); });
        posts.reverse().forEach(p => {
            if(p.groupKey === user.groupKey && !blockedUsers.includes(p.uid)) {
                let content = "";
                if(p.type === 'poll') {
                    const v1 = p.options.opt1.votes || 0, v2 = p.options.opt2.votes || 0, total = v1 + v2 || 1;
                    const p1 = (v1/total)*100, p2 = (v2/total)*100;
                    content = `<b>${p.question}</b>
                        <div class="poll-option" onclick="vote('${p.id}', 'opt1')">
                            <div class="poll-bar" style="width:${p1}%"></div>
                            <div class="poll-text"><span>${p.options.opt1.txt}</span><span>${Math.round(p1)}%</span></div>
                        </div>
                        <div class="poll-option" onclick="vote('${p.id}', 'opt2')">
                            <div class="poll-bar" style="width:${p2}%"></div>
                            <div class="poll-text"><span>${p.options.opt2.txt}</span><span>${Math.round(p2)}%</span></div>
                        </div>`;
                } else {
                    content = `<p>${p.msg}</p>${p.img ? `<img src="${p.img}" class="post-img">`:''}`;
                }
                
                let delBtn = p.uid === user.uid ? `<span class="action-btn" onclick="deletePost('${p.id}')">Delete</span>` : "";
                cont.innerHTML += `<div class="card">
                    <div style="font-size:12px; margin-bottom:8px;"><b>${p.name}</b> <small>${formatTime(p.time)}</small> ${delBtn}</div>
                    ${content}
                </div>`;
            }
        });
    });
}

function vote(pid, opt) { db.ref(`posts/${pid}/options/${opt}/votes`).transaction(c => (c || 0) + 1); }
function deletePost(id) { if(confirm("Delete post?")) db.ref('posts/'+id).remove(); }

// --- INVITE FRIEND ---
function inviteFriend() {
    const appLink = window.location.href; // నీ GitHub Pages లింక్ ఇక్కడ ఆటోమేటిక్ గా వస్తుంది
    const msg = `హే ఫ్రెండ్! మన పాత బ్యాచ్‌మేట్స్ అందరం కలిసి ఉండటానికి ఈ 'Alumni Connect' యాప్ వాడుతున్నాం. నువ్వు కూడా జాయిన్ అవ్వు! \n\nలింక్: ${appLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// --- NETWORK & CHAT ---
function searchAlumni() {
    const sInst = cleanString(document.getElementById('s-inst').value);
    const sCity = cleanString(document.getElementById('s-inst-city').value);
    const sYear = document.getElementById('s-year').value;
    const sGroup = cleanString(document.getElementById('s-group').value);
    db.ref('users').once('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            const match = (!sInst || cleanString(u.inst).includes(sInst)) && (!sCity || cleanString(u.instCity).includes(sCity)) && (!sYear || u.year == sYear) && (!sGroup || cleanString(u.group).includes(sGroup));
            if(match) list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <div><b>${u.name}</b><br><small>${u.inst} (${u.year})</small></div>
                <button class="btn btn-blue" style="width:auto; padding:5px 10px;" onclick="addFriend('${c.key}','${u.name}')">Connect</button>
            </div>`;
        });
    });
}

function addFriend(uid, name) { db.ref('friends/'+user.uid+'/'+uid).set({name: name}); db.ref('friends/'+uid+'/'+user.uid).set({name: user.name}); showToast("Connected!"); }
function loadMyFriends() {
    db.ref('friends/'+user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>My Network</h4>";
        snap.forEach(c => { list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>${c.val().name}</b><button class="btn btn-blue" style="width:auto; padding:5px 10px;" onclick="openChat('${c.key}','${c.val().name}')">Chat</button></div>`; });
    });
}

function openChat(uid, name) { currentChatFriendUID = uid; document.getElementById('chat-with-name').innerText = name; document.getElementById('chat-window').style.display = "flex"; loadMessages(); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim(); if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('privateMsgInput').value = "";
}
async function sendPhoto() {
    const file = document.getElementById('chatPhotoInput').files[0]; if(!file) return;
    const b = await processImage(file);
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, img: b, time: Date.now() });
}
function loadMessages() {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(), isMine = m.sender === user.uid;
            c.innerHTML += `<div class="msg-bubble ${isMine?'mine':'theirs'}">${m.text || `<img src="${m.img}" class="chat-img">`}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function saveProfile() {
    db.ref('users/'+user.uid).update({
        inst: document.getElementById('p-inst').value, instCity: document.getElementById('p-inst-city').value,
        year: document.getElementById('p-year').value, group: document.getElementById('p-group').value
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
function logout() { auth.signOut().then(() => location.reload()); }
function showToast(m) { const t = document.getElementById("toast"); t.innerText = m; t.className = "show"; setTimeout(() => t.className = "", 3000); }
