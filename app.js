const firebaseConfig = {
    apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
    authDomain: "class-connect-b58f0.firebaseapp.com",
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "class-connect-b58f0",
    storageBucket: "class-connect-b58f0.firebasestorage.app",
    messagingSenderId: "836461719745",
    appId: "1:836461719745:web:f827862e4db4954626a440"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let user = null;
let currentChatId = null;
let pollActive = false;

// 1. Auth & Online Status
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "" };
            updateUI(); loadFeed(); listenNotifs(); loadCircle(); syncOnlineStatus(); checkMemories(); checkAutomaticGroup();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function syncOnlineStatus() {
    const statusRef = db.ref(`status/${user.uid}`);
    statusRef.set({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    statusRef.onDisconnect().set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
}

// 2. Profile & UI
function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    if(user.inst) document.getElementById('u-badge').style.display = "inline-block";
}

function updateProfile() {
    const d = { 
        name: document.getElementById('p-name').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        uClass: document.getElementById('p-class').value, 
        city: document.getElementById('p-city').value 
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Updated Successfully!"));
}

// 3. Feed (Posts, Polls, Comments, Memories)
function togglePollUI() {
    pollActive = !pollActive;
    document.getElementById('poll-box').style.display = pollActive ? 'block' : 'none';
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), likes: 0 };
    
    if(pollActive) {
        postData.poll = { q: document.getElementById('poll-q').value, o1: document.getElementById('poll-o1').value, o2: document.getElementById('poll-o2').value, v1: 0, v2: 0 };
    }
    if(file) postData.media = await toBase64(file);
    
    db.ref('posts').push(postData);
    document.getElementById('msgInput').value = "";
    togglePollUI();
}

function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            let pollHtml = p.poll ? `<div class="card" style="border:1px solid #ddd;"><b>${p.poll.q}</b><br><button onclick="vote('${pid}','v1')" class="btn-primary" style="width:45%; margin:5px;">${p.poll.o1} (${p.poll.v1})</button><button onclick="vote('${pid}','v2')" class="btn-primary" style="width:45%; margin:5px;">${p.poll.o2} (${p.poll.v2})</button></div>` : "";
            
            let commentsHtml = "";
            if(p.comments) Object.values(p.comments).forEach(c => { commentsHtml += `<div style="font-size:12px; background:#f0f2f5; padding:5px; margin-top:2px; border-radius:5px;"><b>${c.name}:</b> ${c.text}</div>`; });

            cont.innerHTML = `
                <div class="card">
                    <div style="display:flex; justify-content:space-between;">
                        <div style="display:flex; gap:10px; align-items:center;">
                            <img src="${p.userPhoto}" style="width:30px; height:30px; border-radius:50%;">
                            <b>${p.userName}</b>
                        </div>
                        ${p.uid === user.uid ? `<i class="fas fa-trash" onclick="deletePost('${pid}')" style="color:red; font-size:12px;"></i>` : ""}
                    </div>
                    <p>${p.msg}</p>
                    ${p.media ? (p.media.includes('video') ? `<video src="${p.media}" controls class="post-img"></video>` : `<img src="${p.media}" class="post-img">`) : ""}
                    ${pollHtml}
                    <div style="margin-top:10px; display:flex; gap:15px; color:var(--primary); font-weight:600;">
                        <span onclick="likePost('${pid}')"><i class="fas fa-heart"></i> ${p.likes || 0}</span>
                        <span onclick="translatePost('${pid}', this)"><i class="fas fa-language"></i> Translate</span>
                    </div>
                    <div style="margin-top:10px;">
                        ${commentsHtml}
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <input type="text" id="comm-${pid}" placeholder="Comment..." style="margin:0; padding:5px;">
                            <button onclick="addComment('${pid}')" class="btn-primary" style="width:60px; padding:5px;">Send</button>
                        </div>
                    </div>
                    <small class="timestamp">${new Date(p.time).toLocaleString()}</small>
                </div>` + cont.innerHTML;
        });
    });
}

// 4. Smart Chat (Sharing, Translation, Deletion)
function sendChatMessage() {
    const text = document.getElementById('chatInput').value;
    const file = document.getElementById('chat-file').files[0];
    if(!text && !file) return;

    const msgObj = { sender: user.uid, time: Date.now() };
    if(text) msgObj.text = text;
    if(file) toBase64(file).then(b64 => { msgObj.media = b64; db.ref(`chats/${currentChatId}`).push(msgObj); });
    else db.ref(`chats/${currentChatId}`).push(msgObj);

    document.getElementById('chatInput').value = "";
}

function openChat(targetUid, targetName, targetImg) {
    currentChatId = user.uid < targetUid ? user.uid+"_"+targetUid : targetUid+"_"+user.uid;
    document.getElementById('chat-target-name').innerText = targetName;
    document.getElementById('chat-target-img').src = targetImg;
    show('chat-window');
    
    // Check Online Status
    db.ref(`status/${targetUid}`).on('value', s => {
        const status = s.val();
        document.getElementById('online-status').innerText = status?.online ? "Online" : "Last seen: " + new Date(status?.lastSeen).toLocaleTimeString();
    });

    db.ref(`chats/${currentChatId}`).on('value', snap => {
        const cont = document.getElementById('chat-messages'); cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); const isMine = m.sender === user.uid;
            let content = m.text ? `<span>${m.text}</span>` : `<img src="${m.media}" class="chat-media">`;
            const del = isMine ? `<i class="fas fa-trash-alt" style="font-size:10px; margin-left:10px;" onclick="deleteMsg('${s.key}')"></i>` : "";
            cont.innerHTML += `<div class="${isMine?'msg-sent':'msg-received'}">${content}${del}<small class="timestamp">${new Date(m.time).toLocaleTimeString()}</small></div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

// 5. Automatic Group Logic
function checkAutomaticGroup() {
    if(user.inst && user.year) {
        const groupName = `${user.inst}_${user.year}`;
        const safeGroup = groupName.replace(/[.#$/[\]]/g, "_");
        db.ref(`groups/${safeGroup}/members/${user.uid}`).set(user.name);
        loadGroups();
    }
}

function loadGroups() {
    db.ref('groups').on('value', snap => {
        const cont = document.getElementById('groups-list'); cont.innerHTML = "";
        snap.forEach(s => {
            if(s.val().members && s.val().members[user.uid]) {
                cont.innerHTML += `<div class="card" onclick="openGroupChat('${s.key}')"><b>${s.key.replace(/_/g," ")}</b> (Group)</div>`;
            }
        });
    });
}

// 6. AI Chatbot
async function askAI() {
    const input = document.getElementById('aiInput');
    const msg = input.value; if(!msg) return;
    const cont = document.getElementById('ai-messages');
    cont.innerHTML += `<div class="msg-sent">${msg}</div>`;
    input.value = "";
    
    // Placeholder AI Response
    setTimeout(() => {
        cont.innerHTML += `<div class="msg-received">Based on your Master's in Math, you might enjoy career paths in Data Science or Actuarial roles. Check the Ideas page!</div>`;
        cont.scrollTop = cont.scrollHeight;
    }, 1000);
}

// 7. Search Classmates (4 Filters)
function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    const year = document.getElementById('s-year').value;
    const uClass = document.getElementById('s-class').value.toLowerCase();
    const city = document.getElementById('s-city').value.toLowerCase();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            if(u.inst.toLowerCase().includes(inst) && (!year || u.year == year) && u.uClass.toLowerCase().includes(uClass) && u.city.toLowerCase().includes(city)) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <img src="${u.photo}" style="width:40px; height:40px; border-radius:50%;">
                        <div><b>${u.name}</b><br><small>${u.inst} | ${u.year}</small></div>
                    </div>
                    <button onclick="sendRequest('${c.key}','${u.name}')" class="btn-primary" style="width:auto; margin:0; padding:5px 10px;">Connect</button>
                </div>`;
            }
        });
    });
}

// 8. Translation & Helpers
function translatePost(pid, el) {
    el.innerText = "Translating...";
    setTimeout(() => { el.innerText = "Translated to Telugu (Simulated)"; }, 1000);
}

function shareInvite() {
    const link = "https://classmate-connect-global.web.app";
    window.open(`https://api.whatsapp.com/send?text=Join our global institution network on Classmate Connect: ${link}`, '_blank');
}

function checkMemories() {
    const today = new Date().toLocaleDateString();
    // Logic to find posts from "Today" in previous years
    document.getElementById('memories-box').innerHTML = `<div class="card" style="background:lightyellow;"><b>On This Day Memories:</b> You connected with ${user.inst} 1 year ago!</div>`;
}

// General Utilities
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}
function toBase64(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsDataURL(file); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function changeTheme(theme) { document.body.className = theme; }
function toggleDarkMode() { document.body.classList.toggle('dark'); }
function deletePost(pid) { if(confirm("Delete this post?")) db.ref(`posts/${pid}`).remove(); }
function likePost(pid) { db.ref(`posts/${pid}/likes`).transaction(c => (c || 0) + 1); }
function addComment(pid) { const t = document.getElementById(`comm-${pid}`).value; if(t) db.ref(`posts/${pid}/comments`).push({name:user.name, text:t}); document.getElementById(`comm-${pid}`).value=""; }
function sendRequest(uid, name) { db.ref(`notifications/${uid}`).push({ from: user.name, fromUid: user.uid, type: 'request' }); alert("Request sent to " + name); }
function loadCircle() { db.ref(`friends/${user.uid}`).on('value', snap => { const fl = document.getElementById('friends-list'); fl.innerHTML = ""; snap.forEach(s => { fl.innerHTML += `<div class="card" onclick="openChat('${s.key}','${s.val().name}','${s.val().photo}')">${s.val().name}</div>`; }); }); }
function listenNotifs() { db.ref(`notifications/${user.uid}`).on('value', snap => { const b = document.getElementById('circle-badge'); if(snap.exists()) { b.innerText = snap.numChildren(); b.style.display="block"; } else b.style.display="none"; }); }
