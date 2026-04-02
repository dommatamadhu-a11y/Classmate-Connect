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
let initialLoad = true;

// --- NOTIFICATION HELPER ---
function notify(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

// --- AUTHENTICATION ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { 
                uid: u.uid, name: u.displayName, photo: d?.photo || u.photoURL, 
                inst: d?.inst || "", city: d?.city || "", uClass: d?.uClass || "", year: d?.year || "" 
            };
            updateUI();
            loadFeed();
            listenForRequests();
            listenForMessages();
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
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-year').value = user.year;
}

// --- PROFILE ACTIONS ---
function saveProfile() {
    const data = {
        inst: document.getElementById('p-inst').value, 
        city: document.getElementById('p-city').value,
        uClass: document.getElementById('p-class').value,
        year: document.getElementById('p-year').value 
    };
    db.ref('users/' + user.uid).update(data).then(() => {
        notify("Profile Successfully Registered!");
    });
}

// --- AUTOMATIC GROUP FEED ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!txt) return;

    if(!user.inst || !user.year) {
        notify("Complete your profile to post!");
        return;
    }

    const groupKey = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    const file = document.getElementById('feedPhotoInput').files[0];
    let imgData = "";
    
    if(file) {
        const reader = new FileReader();
        imgData = await new Promise(r => { reader.onload = e => r(e.target.result); reader.readAsDataURL(file); });
    }

    db.ref('posts').push({ 
        uid: user.uid, name: user.name, msg: txt, img: imgData, time: Date.now(), filterKey: groupKey 
    }).then(() => {
        notify("Post shared with your batch!");
        document.getElementById('msgInput').value = "";
        document.getElementById('feedPhotoInput').value = "";
    });
}

function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container');
        cont.innerHTML = "";
        const myKey = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
        
        snap.forEach(s => {
            const p = s.val();
            if(p.filterKey === myKey) {
                const likes = p.likes ? Object.keys(p.likes).length : 0;
                const isLiked = p.likes && p.likes[user.uid] ? 'liked' : '';
                cont.innerHTML = `
                <div class="card">
                    <b>${p.name}</b><p>${p.msg}</p>
                    ${p.img ? `<img src="${p.img}" class="post-img">` : ''}
                    <div class="post-actions">
                        <span class="action-btn ${isLiked}" onclick="toggleLike('${s.key}')"><i class="${isLiked?'fas':'far'} fa-heart"></i> ${likes}</span>
                        <span class="action-btn" onclick="toggleComments('${s.key}')"><i class="far fa-comment"></i> Comments</span>
                    </div>
                    <div id="comment-area-${s.key}" class="comment-section">
                        <div id="list-${s.key}"></div>
                        <div style="display:flex; gap:5px; margin-top:10px;">
                            <input type="text" id="in-${s.key}" placeholder="Write a comment..." style="margin-bottom:0;">
                            <button onclick="addComment('${s.key}')" class="btn-blue" style="width:45px;"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>` + cont.innerHTML;
                loadComments(s.key);
            }
        });
    });
}

// --- SEARCH & CONNECTION NOTIFICATIONS ---
function searchClassmates() {
    const sInst = document.getElementById('s-inst').value.toUpperCase();
    const sCity = document.getElementById('s-city').value.toUpperCase();
    const sClass = document.getElementById('s-class').value.toUpperCase();
    const sYear = document.getElementById('s-year').value;

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "<h4>Search Results</h4>";
        snap.forEach(c => {
            const u = c.val();
            if(c.key === user.uid) return;
            const match = (!sInst || (u.inst && u.inst.toUpperCase().includes(sInst))) &&
                          (!sCity || (u.city && u.city.toUpperCase().includes(sCity))) &&
                          (!sClass || (u.uClass && u.uClass.toUpperCase().includes(sClass))) &&
                          (!sYear || u.year == sYear);
            if(match && (sInst || sCity || sClass || sYear)) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.uClass || ''} • ${u.inst || ''}</small></div>
                    <button class="btn-blue" style="width:auto; padding:8px 15px;" onclick="connect('${c.key}','${u.name}')">Connect</button>
                </div>`;
            }
        });
    });
}

function connect(uid, name) {
    db.ref('friends/' + user.uid + '/' + uid).once('value', s => {
        if(s.exists()) openChat(uid, name);
        else {
            db.ref('friend_requests/' + uid + '/' + user.uid).set({ fromName: user.name })
            .then(() => notify("Request Sent Successfully!"));
        }
    });
}

function listenForRequests() {
    db.ref('friend_requests/' + user.uid).on('value', snap => {
        const list = document.getElementById('requests-list');
        const dot = document.getElementById('request-dot');
        if(snap.exists()){
            document.getElementById('requests-section').style.display = "block";
            dot.style.display = "block";
            if(!initialLoad) notify("You have a new connection request!");
            list.innerHTML = "";
            snap.forEach(s => {
                list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span><b>${s.val().fromName}</b></span>
                    <button class="btn-blue" style="width:auto; padding:5px 10px;" onclick="accept('${s.key}', '${s.val().fromName}')">Accept</button>
                </div>`;
            });
        } else {
            document.getElementById('requests-section').style.display = "none";
            dot.style.display = "none";
        }
        initialLoad = false;
    });
}

function accept(fid, name) {
    db.ref('friends/' + user.uid + '/' + fid).set(true);
    db.ref('friends/' + fid + '/' + user.uid).set(true);
    db.ref('friend_requests/' + user.uid + '/' + fid).remove()
    .then(() => notify("You are now connected with " + name));
}

// --- MESSAGE NOTIFICATIONS ---
function listenForMessages() {
    db.ref('friends/' + user.uid).on('child_added', snap => {
        const fid = snap.key;
        const cid = user.uid < fid ? user.uid+'_'+fid : fid+'_'+user.uid;
        db.ref('private_messages/' + cid).limitToLast(1).on('child_added', m => {
            const msg = m.val();
            if(msg.sender !== user.uid && (Date.now() - msg.time < 3000)) {
                notify("New message received!");
            }
        });
    });
}

function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim();
    if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/' + cid).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('privateMsgInput').value = "";
}

// --- CHAT WINDOW ---
function openChat(uid, name) {
    currentChatFriendUID = uid;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid+'_'+uid : uid+'_'+user.uid;
    db.ref('private_messages/' + cid).on('value', snap => {
        const c = document.getElementById('chat-messages');
        c.innerHTML = "";
        snap.forEach(s => { c.innerHTML += `<div class="msg-bubble ${s.val().sender === user.uid ? 'mine' : 'theirs'}">${s.val().text}</div>`; });
        c.scrollTop = c.scrollHeight;
    });
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }

// --- UI HELPERS ---
function show(id, event, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active-nav');
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
        const list = document.getElementById(`list-${pid}`);
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(s => { list.innerHTML += `<div class="comment-item"><b>${s.val().name}:</b> ${s.val().text}</div>`; });
    });
}
function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
