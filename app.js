// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
    authDomain: "class-connect-b58f0.firebaseapp.com",
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "class-connect-b58f0",
    storageBucket: "class-connect-b58f0.firebasestorage.app",
    messagingSenderId: "836461719745",
    appId: "1:836461719745:web:f827862e4db4954626a440",
    measurementId: "G-8QT4VQ5YW5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let user = null;
let activeChatUid = "";
let blockedList = []; 

// --- 1. Daily Quotes (English) ---
const quotes = [
    "Education is the most powerful weapon which you can use to change the world.",
    "The beautiful thing about learning is that no one can take it away from you.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The best way to predict your future is to create it.",
    "Your education is a dress rehearsal for a life that is yours to lead."
];
const quoteEl = document.getElementById('daily-quote');
if(quoteEl) quoteEl.innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;

// --- 2. Auth State & Global Initialization ---
auth.onAuthStateChanged(u => {
    if(u) {
        if(document.getElementById('login-overlay')) document.getElementById('login-overlay').style.display = "none";
        
        // Load Block List First
        db.ref('blocks/' + u.uid).on('value', snap => {
            blockedList = snap.val() ? Object.keys(snap.val()) : [];
            
            // Load User Profile
            db.ref('users/' + u.uid).on('value', s => {
                const d = s.val() || {};
                user = { 
                    uid: u.uid, name: u.displayName, photo: d.photo || u.photoURL, 
                    inst: d.inst || "", uClass: d.uClass || "", year: d.year || "", city: d.city || "" 
                };
                
                // Track Online Status
                db.ref('status/' + u.uid).set({ state: 'online', last: Date.now() });
                db.ref('status/' + u.uid).onDisconnect().set({ state: 'offline', last: Date.now() });

                syncUI(); loadFeed(); loadFriends(); listenNotifs(); loadStories();
            });
        });
    } else {
        if(document.getElementById('login-overlay')) document.getElementById('login-overlay').style.display = "flex";
    }
});

// --- 3. Profile Management (4 Functional Fields) ---
function syncUI() {
    if(!user) return;
    document.getElementById('h-img').src = user.photo;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').innerText = user.name;
    
    // Mapping 4 Fields to UI
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    
    if(user.inst && user.year) {
        const groupTag = document.getElementById('group-tag');
        if(groupTag) {
            groupTag.style.display = "block";
            document.getElementById('group-text').innerText = `${user.inst} | ${user.uClass} | ${user.year}`;
        }
    }
}

function saveProfile() {
    const inst = document.getElementById('p-inst').value;
    const year = document.getElementById('p-year').value;
    const uClass = document.getElementById('p-class').value;
    const city = document.getElementById('p-city').value;
    
    if(!inst || !year) return notify("Institution & Year are mandatory!");
    
    db.ref('users/' + user.uid).update({ inst, year, uClass, city })
      .then(() => notify("Profile Updated Successfully!"));
}

// --- 4. Safety Logic: Block & Report ---
function blockUser(targetUid) {
    if(confirm("Are you sure you want to block this user? You will no longer see their content.")) {
        db.ref(`blocks/${user.uid}/${targetUid}`).set(true);
        notify("User Blocked");
        location.reload();
    }
}

function reportContent(postId) {
    const reason = prompt("Enter reason for reporting (e.g., Spam, Harassment, Inappropriate):");
    if(reason) {
        db.ref('reports').push({ 
            reporter: user.uid, 
            postId: postId, 
            reason: reason, 
            time: Date.now() 
        });
        notify("Content reported to Admin.");
    }
}

// --- 5. Feed, Media Sharing & Polls ---
async function handlePost() {
    const msg = document.getElementById('msgInput').value.trim();
    const isPoll = document.getElementById('poll-creator').style.display === 'block';
    let mediaData = ""; let mediaType = "text";
    
    const fImg = document.getElementById('f-img').files[0];
    const fVid = document.getElementById('f-vid').files[0];
    const fPdf = document.getElementById('f-pdf').files[0];

    if(fImg) { mediaData = await toBase64(fImg); mediaType = "image"; }
    else if(fVid) { mediaData = await toBase64(fVid); mediaType = "video"; }
    else if(fPdf) { mediaData = await toBase64(fPdf); mediaType = "pdf"; }

    if(!msg && !mediaData && !isPoll) return notify("Please add some content.");

    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    const postObj = { 
        uid: user.uid, userName: user.name, userPhoto: user.photo, 
        msg, media: mediaData, mediaType, time: Date.now(), groupKey: gKey 
    };

    if(isPoll) {
        postObj.poll = { 
            q: document.getElementById('poll-q').value, 
            o1: { t: document.getElementById('poll-o1').value, v: 0 }, 
            o2: { t: document.getElementById('poll-o2').value, v: 0 } 
        };
    }

    db.ref('posts').push(postObj);
    resetPostUI(); notify("Shared with Classmates!");
}

function loadFeed() {
    if(!user.inst) return;
    const gKey = (user.inst + user.year + user.uClass).replace(/\s/g, '').toUpperCase();
    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        const container = document.getElementById('post-container'); if(!container) return;
        container.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            if(blockedList.includes(p.uid)) return; // Filtering Blocked Users

            const time = new Date(p.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const hasLiked = p.likes && p.likes[user.uid];
            
            let mediaHTML = p.mediaType === 'image' ? `<img src="${p.media}" class="post-img">` : 
                           (p.mediaType === 'video' ? `<video src="${p.media}" controls class="post-img"></video>` : 
                           (p.mediaType === 'pdf' ? `<div class="pdf-box"><a href="${p.media}" download><i class="fas fa-file-pdf"></i> Download PDF</a></div>` : ""));
            
            let pollHTML = p.poll ? `<div class="poll-card"><b>${p.poll.q}</b><div class="opt" onclick="vote('${s.key}', 'o1')">${p.poll.o1.t} (${p.poll.o1.v})</div><div class="opt" onclick="vote('${s.key}', 'o2')">${p.poll.o2.t} (${p.poll.o2.v})</div></div>` : "";

            const actionBtns = p.uid === user.uid ? 
                `<i class="fas fa-trash" onclick="deletePost('${s.key}')"></i>` : 
                `<i class="fas fa-flag" onclick="reportContent('${s.key}')" title="Report"></i> <i class="fas fa-user-slash" onclick="blockUser('${p.uid}')" style="margin-left:10px;" title="Block User"></i>`;

            container.innerHTML = `
                <div class="card glass active">
                    <span class="post-menu">${actionBtns}</span>
                    <div class="post-header"><img src="${p.userPhoto}"><div class="post-info"><b>${p.userName}</b><small>${time}</small></div></div>
                    <p class="post-msg">${p.msg}</p>${mediaHTML}${pollHTML}
                    <div class="post-actions">
                        <div onclick="likePost('${s.key}')"><i class="fa${hasLiked?'s':'r'} fa-heart"></i> ${p.likes?Object.keys(p.likes).length:0}</div>
                        <div onclick="toggleComments('${s.key}')"><i class="far fa-comment"></i> Replies</div>
                    </div>
                    <div id="comments-${s.key}" class="comment-section" style="display:none;">
                        <div id="list-${s.key}"></div>
                        <div class="reply-input-box">
                            <input type="text" id="input-${s.key}" placeholder="Write a reply...">
                            <button onclick="addComment('${s.key}')">Post</button>
                        </div>
                    </div>
                </div>` + container.innerHTML;
            loadComments(s.key);
        });
    });
}

// --- 6. Stories (Auto-delete after 24H) ---
async function addStory() {
    const i = document.createElement('input'); i.type='file'; i.accept='image/*';
    i.onchange = async e => {
        const b64 = await toBase64(e.target.files[0]);
        db.ref('stories').push({ 
            uid: user.uid, userName: user.name, userPhoto: user.photo, 
            content: b64, expires: Date.now() + 86400000 
        });
        notify("Story Uploaded!");
    }; i.click();
}

function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list'); if(!list) return;
        list.innerHTML = `<div class="story-circle add-btn" onclick="addStory()"><i class="fas fa-plus"></i></div>`;
        snap.forEach(s => {
            const d = s.val();
            if(blockedList.includes(d.uid)) return; 
            if(d.expires < Date.now()) db.ref('stories/' + s.key).remove();
            else list.innerHTML += `<div class="story-circle" onclick="window.open('${d.content}')"><img src="${d.userPhoto}"></div>`;
        });
    });
}

// --- 7. Search Classmates (4 Filters) ---
function search() {
    const si = document.getElementById('s-inst').value.toUpperCase().trim();
    const sy = document.getElementById('s-year').value.trim();
    const sc = document.getElementById('s-class').value.toUpperCase().trim();
    const st = document.getElementById('s-city').value.toUpperCase().trim();

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results'); res.innerHTML = "";
        let found = false;
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid || blockedList.includes(c.key)) return;
            let match = true;
            if(si && (!u.inst || !u.inst.toUpperCase().includes(si))) match = false;
            if(sy && (!u.year || u.year != sy)) match = false;
            if(sc && (!u.uClass || !u.uClass.toUpperCase().includes(sc))) match = false;
            if(st && (!u.city || !u.city.toUpperCase().includes(st))) match = false;

            if(match && (si || sy || sc || st)) {
                found = true;
                res.innerHTML += `<div class="card glass search-item">
                    <div class="user-meta"><b>${u.name}</b><br><small>${u.inst || ''} | ${u.uClass || ''} (${u.city || ''})</small></div>
                    <button onclick="sendReq('${c.key}', this)" class="btn-primary">Connect</button>
                </div>`;
            }
        });
        if(!found) res.innerHTML = "<p class='no-results'>No classmates found for these filters.</p>";
    });
}

// --- 8. AI, Chat & Social Functions ---
function askAI() {
    const input = document.getElementById('ai-input'); const msgBox = document.getElementById('ai-msgs');
    const q = input.value.toLowerCase().trim(); if(!q) return;
    msgBox.innerHTML += `<div class="u-msg"><b>Me:</b> ${q}</div>`;
    let res = "I can help you find classmates, share files, or manage your profile.";
    if(q.includes("block")) res = "You can block users by clicking the 'user-slash' icon on their posts.";
    if(q.includes("story")) res = "Stories disappear after 24 hours. Use the '+' icon at the top.";
    setTimeout(() => { 
        msgBox.innerHTML += `<div class="ai-msg"><b>AI:</b> ${res}</div>`; 
        msgBox.scrollTop = msgBox.scrollHeight; 
    }, 500);
    input.value = "";
}

function openChat(uid, name) {
    if(blockedList.includes(uid)) return notify("This user is blocked.");
    activeChatUid = uid; document.getElementById('chat-user').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid + '_' + uid : uid + '_' + user.uid;
    db.ref('chats/' + cid).on('value', snap => {
        const c = document.getElementById('chat-msgs'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            c.innerHTML += `<div class="msg-bubble ${m.sender === user.uid ? 'mine' : 'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function sendMsg() {
    const v = document.getElementById('chatInput').value.trim(); if(!v) return;
    const cid = user.uid < activeChatUid ? user.uid + '_' + activeChatUid : activeChatUid + '_' + user.uid;
    db.ref('chats/' + cid).push({ sender: user.uid, text: v, time: Date.now() });
    db.ref(`notifications/${activeChatUid}`).push({ type: 'msg', fromName: user.name, text: v });
    document.getElementById('chatInput').value = "";
}

// --- 9. Common Utility Functions ---
function toBase64(file) { return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); }); }
function notify(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function resetPostUI() { document.getElementById('msgInput').value = ""; document.getElementById('poll-creator').style.display = 'none'; document.querySelectorAll('input[type="file"]').forEach(i => i.value = ""); }
function togglePollCreator() { const p = document.getElementById('poll-creator'); p.style.display = p.style.display==='none'?'block':'none'; }
function toggleAI() { const a = document.getElementById('ai-window'); a.style.display = a.style.display==='none'?'flex':'none'; }
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); 
    document.getElementById(id).classList.add('active'); el.classList.add('active-nav'); 
}
function sendReq(toUid, btn) { db.ref(`notifications/${toUid}`).push({ type: 'req', fromName: user.name, fromUid: user.uid }).then(() => { notify("Request Sent!"); btn.innerText = "Sent"; btn.disabled = true; }); }
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function deletePost(id) { if(confirm("Delete this post permanently?")) db.ref('posts/'+id).remove(); }
function vote(pid, opt) { db.ref(`posts/${pid}/poll/${opt}/v`).transaction(v => (v || 0) + 1); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }

// --- Friend & Notification Logic ---
function loadFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('friends-list'); if(!list) return; list.innerHTML = "";
        snap.forEach(s => {
            if(blockedList.includes(s.key)) return;
            db.ref('users/' + s.key).once('value', usnap => {
                const u = usnap.val();
                db.ref('status/' + s.key).on('value', st => {
                    const status = st.val()?.state === 'online' ? 'online' : 'offline';
                    list.innerHTML += `<div class="friend-card" onclick="openChat('${s.key}', '${u.name}')"><span class="status ${status}"></span><b>${u.name}</b><i class="fas fa-chevron-right"></i></div>`;
                });
            });
        });
    });
}
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const l = document.getElementById('notif-list'); if(!l) return; l.innerHTML = "";
        const b = document.getElementById('notif-badge');
        if(snap.exists()) {
            b.innerText = snap.numChildren(); b.style.display = "block";
            snap.forEach(s => {
                const n = s.val(); if(blockedList.includes(n.fromUid)) return;
                if(n.type === 'req') l.innerHTML += `<div class="notif-item"><b>${n.fromName}</b> sent a request. <button onclick="acceptReq('${n.fromUid}', '${s.key}')">Accept</button></div>`;
                else l.innerHTML += `<div class="notif-item"><b>${n.fromName}:</b> ${n.text}</div>`;
            });
        } else { b.style.display = "none"; }
    });
}
function acceptReq(fid, nid) { db.ref(`friends/${user.uid}/${fid}`).set(true); db.ref(`friends/${fid}/${user.uid}`).set(true); db.ref(`notifications/${user.uid}/${nid}`).remove(); notify("Connected!"); }
function likePost(id) { db.ref(`posts/${id}/likes/${user.uid}`).set(true); }
function toggleComments(id) { const b = document.getElementById(`comments-${id}`); b.style.display = b.style.display === 'block' ? 'none' : 'block'; }
function addComment(pid) { const i = document.getElementById(`input-${pid}`); if(!i.value) return; db.ref(`posts/${pid}/comments`).push({ name: user.name, text: i.value }); i.value = ""; }
function loadComments(pid) { db.ref(`posts/${pid}/comments`).on('value', snap => { const l = document.getElementById(`list-${pid}`); if(!l) return; l.innerHTML = ""; snap.forEach(s => { l.innerHTML += `<div class="comment"><b>${s.val().name}:</b> ${s.val().text}</div>`; }); }); }
