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
    t.innerText = msg; 
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
}

function formatTime(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
}

auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            // Use DB photo if exists, else fallback to Google photo
            user = { 
                uid: u.uid, 
                name: u.displayName, 
                photo: d?.photo || u.photoURL, 
                inst: d?.inst || "", 
                city: d?.city || "", 
                uClass: d?.uClass || "", 
                year: d?.year || "" 
            };
            blockedUsers = d?.blocked || [];
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

// PROFILE PHOTO BASE64 UPLOAD
function handleProfilePhoto() {
    const file = document.getElementById('p-image-input').files[0];
    if (file) {
        const reader = new FileReader();
        notify("Processing photo...");
        reader.onload = function(e) {
            const base64Img = e.target.result;
            // Saving directly to Realtime Database
            db.ref('users/' + user.uid).update({ photo: base64Img })
            .then(() => notify("Profile Photo Updated!"))
            .catch(() => notify("Failed to update photo."));
        };
        reader.readAsDataURL(file);
    }
}

// FEED LOGIC
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!txt || !user.inst) return notify("Complete your profile first!");
    
    const key = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    const file = document.getElementById('feedPhotoInput').files[0];
    let img = "";
    
    if(file) {
        const r = new FileReader(); 
        img = await new Promise(res => { 
            r.onload = e => res(e.target.result); 
            r.readAsDataURL(file); 
        });
    }
    
    db.ref('posts').push({ 
        uid: user.uid, 
        name: user.name, 
        msg: txt, 
        img, 
        time: Date.now(), 
        filterKey: key 
    })
    .then(() => { 
        notify("Posted!"); 
        document.getElementById('msgInput').value = ""; 
        document.getElementById('feedPhotoInput').value = ""; 
    });
}

function loadFeed() {
    const myKey = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); 
        cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            if(p.filterKey === myKey) {
                const likes = p.likes ? Object.keys(p.likes).length : 0;
                const isLiked = p.likes && p.likes[user.uid] ? 'liked' : '';
                cont.innerHTML = `
                <div class="card">
                    <b>${p.name}</b> <small style="color:var(--sub)">• ${formatTime(p.time)}</small>
                    <p>${p.msg}</p>
                    ${p.img ? `<img src="${p.img}" class="post-img">` : ''}
                    <div class="post-actions">
                        <span class="action-btn ${isLiked}" onclick="toggleLike('${s.key}')"><i class="fas fa-heart"></i> ${likes}</span>
                        <span class="action-btn" onclick="toggleComments('${s.key}')"><i class="fas fa-comment"></i> Comments</span>
                    </div>
                    <div id="comment-area-${s.key}" class="comment-section">
                        <div id="list-${s.key}"></div>
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <input type="text" id="in-${s.key}" placeholder="Comment...">
                            <button onclick="addComment('${s.key}')" class="btn-blue">></button>
                        </div>
                    </div>
                </div>` + cont.innerHTML;
                loadComments(s.key);
            }
        });
    });
}

// SEARCH LOGIC
function searchClassmates() {
    const sInst = document.getElementById('s-inst').value.toUpperCase().trim();
    const sCity = document.getElementById('s-city').value.toUpperCase().trim();
    const sClass = document.getElementById('s-class').value.toUpperCase().trim();
    const sYear = document.getElementById('s-year').value.trim();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); 
        res.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val(); 
            if(c.key === user.uid) return;
            
            const match = (!sInst || (u.inst && u.inst.toUpperCase().includes(sInst))) &&
                          (!sCity || (u.city && u.city.toUpperCase().includes(sCity))) &&
                          (!sClass || (u.uClass && u.uClass.toUpperCase().includes(sClass))) &&
                          (!sYear || (u.year && u.year.toString() === sYear));
            
            if(match) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${u.photo || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                        <div><b>${u.name}</b><br><small>${u.inst||''} (${u.year||''})</small></div>
                    </div>
                    <button class="btn-blue" style="width:auto; padding:5px 10px;" onclick="connect('${c.key}','${u.name}')">Connect</button>
                </div>`;
            }
        });
    });
}

// CHAT LOGIC
async function sendChatImage() {
    const file = document.getElementById('chatImageInput').files[0];
    if(file) {
        const r = new FileReader(); 
        r.onload = e => pushMsg({ type: 'image', content: e.target.result });
        r.readAsDataURL(file);
    }
}

function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim();
    if(txt) { 
        pushMsg({ type: 'text', content: txt }); 
        document.getElementById('privateMsgInput').value = ""; 
    }
}

function pushMsg(obj) {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/' + cid).push({ 
        sender: user.uid, 
        type: obj.type, 
        content: obj.content, 
        time: Date.now() 
    });
}

function deleteMsg(msgId) {
    if(confirm("Delete for everyone?")) {
        const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
        db.ref(`private_messages/${cid}/${msgId}`).remove();
    }
}

function openChat(uid, name) {
    currentChatFriendUID = uid; 
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid+'_'+uid : uid+'_'+user.uid;
    
    db.ref('private_messages/' + cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); 
        c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); 
            if(blockedUsers.includes(m.sender)) return;
            
            const isMine = m.sender === user.uid;
            const div = document.createElement('div');
            div.className = `msg-bubble ${isMine ? 'mine' : 'theirs'}`;
            div.innerHTML = (m.type === 'image' ? `<img src="${m.content}" class="chat-img">` : m.content) + 
                            `<br><small style="font-size:9px; opacity:0.6">${formatTime(m.time)}</small>`;
            
            if(isMine) div.onclick = () => deleteMsg(s.key);
            c.appendChild(div);
        });
        c.scrollTop = c.scrollHeight;
    });
}

// CORE HELPERS
function toggleLike(pid) { 
    const ref = db.ref(`posts/${pid}/likes/${user.uid}`); 
    ref.once('value', s => s.exists() ? ref.remove() : ref.set(true)); 
}

function toggleComments(pid) { 
    const el = document.getElementById(`comment-area-${pid}`); 
    el.style.display = el.style.display === "block" ? "none" : "block"; 
}

function addComment(pid) { 
    const v = document.getElementById(`in-${pid}`).value.trim(); 
    if(v) { 
        db.ref(`posts/${pid}/comments`).push({ name: user.name, text: v }); 
        document.getElementById(`in-${pid}`).value = ""; 
    } 
}

function loadComments(pid) { 
    db.ref(`posts/${pid}/comments`).on('value', s => { 
        const l = document.getElementById(`list-${pid}`); 
        if(l) { 
            l.innerHTML = ""; 
            s.forEach(c => { 
                l.innerHTML += `<div class="comment-item"><b>${c.val().name}:</b> ${c.val().text}</div>`; 
            }); 
        } 
    }); 
}

function toggleBlock() { 
    if(confirm("Block this user?")) { 
        blockedUsers.push(currentChatFriendUID); 
        db.ref('users/' + user.uid + '/blocked').set(blockedUsers); 
        notify("User Blocked."); 
    } 
}

function saveProfile() { 
    const d = { 
        inst: document.getElementById('p-inst').value, 
        city: document.getElementById('p-city').value, 
        uClass: document.getElementById('p-class').value, 
        year: document.getElementById('p-year').value 
    }; 
    db.ref('users/' + user.uid).update(d).then(() => notify("Profile Updated!")); 
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
            document.getElementById('requests-section').style.display = "block"; 
            const list = document.getElementById('requests-list'); 
            list.innerHTML = ""; 
            snap.forEach(s => { 
                list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>${s.val().fromName}</span> 
                    <button onclick="accept('${s.key}')" class="btn-blue" style="width:auto; padding:4px 8px;">Accept</button>
                </div>`; 
            }); 
        } else { 
            dot.style.display = "none"; 
            document.getElementById('requests-section').style.display = "none"; 
        } 
    }); 
}

function accept(fid) { 
    db.ref('friends/'+user.uid+'/'+fid).set(true); 
    db.ref('friends/'+fid+'/'+user.uid).set(true); 
    db.ref('friend_requests/'+user.uid+'/'+fid).remove(); 
}

function listenForMessages() { 
    db.ref('friends/' + user.uid).on('child_added', snap => { 
        const fid = snap.key; 
        const cid = user.uid < fid ? user.uid+'_'+fid : fid+'_'+user.uid; 
        db.ref('private_messages/' + cid).limitToLast(1).on('child_added', m => { 
            if(m.val().sender !== user.uid && !blockedUsers.includes(m.val().sender) && (Date.now() - m.val().time < 3000)) {
                notify("New Message!"); 
            }
        }); 
    }); 
}

function inviteFriends() { 
    window.open(`https://wa.me/?text=Join Classmate Connect: https://dommatamadhu-a11y.github.io/Classmate-Connect/`, '_blank'); 
}

function show(id, e, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); 
    document.getElementById(id).classList.add('active'); 
    el.classList.add('active-nav'); 
}

function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
