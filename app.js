// Firebase Configuration Setup
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
let currentChatType = ""; // Options: "direct" or "group"
let blocksList = [];

// Authentication Listener and Application Bootstrapper
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = 'none';
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { 
                uid: u.uid, 
                name: d.name || u.displayName, 
                photo: u.photoURL, 
                inst: d.inst || "", 
                year: d.year || "", 
                class: d.class || "", 
                city: d.city || "", 
                skills: d.skills || "",
                badge: d.badge || "Customer" 
            };
            
            // Sync user's block list to handle post and profile exclusions
            db.ref(`blocks/${user.uid}`).on('value', bSnap => {
                blocksList = [];
                bSnap.forEach(bChild => { blocksList.push(bChild.key); });
                
                updateUI();
                loadFeed();
                loadLibrary();
                loadEvents();
                loadMentors();
                loadJobs();
                loadNetworkingHub();
                generateQRCode();
            });
        });
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name.split(' ')[0];
    document.getElementById('profile-name-tag').innerText = user.name;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.class;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
    
    const badgeSpace = document.getElementById('user-badge-space');
    if(badgeSpace) {
        badgeSpace.innerHTML = `<span class="badge-verified">${user.badge}</span>`;
    }
}

// --- Home Feed & Interactive Memory Timeline (Likes, Comments, Polls, Media, Reports) ---
function togglePoll() {
    const ui = document.getElementById('poll-ui');
    ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
}

function previewFile() {
    const file = document.getElementById('f-post').files[0];
    if(file) document.getElementById('file-preview-name').innerText = "Selected: " + file.name;
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    const isPoll = document.getElementById('poll-ui').style.display === 'block';
    
    if(!msg && !file && !isPoll) return alert("Empty Post Content");

    let postData = { uid: user.uid, name: user.name, text: msg, time: Date.now(), badge: user.badge };

    if(isPoll) {
        postData.poll = {
            question: document.getElementById('p-q').value,
            options: [
                {text: document.getElementById('p-1').value, votes: 0},
                {text: document.getElementById('p-2').value, votes: 0}
            ]
        };
    }

    if(file) {
        postData.media = await toBase64(file);
        postData.mediaType = file.type.startsWith('video') ? 'video' : 'image';
    }

    db.ref('posts').push(postData).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('poll-ui').style.display = 'none';
        document.getElementById('file-preview-name').innerText = "";
        sendPushNotificationLog("New network timeline post created by " + user.name);
    });
}

function loadFeed() {
    db.ref('posts').limitToLast(30).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            const id = s.key;
            
            // Privacy Rule: Filter out content from blocked creators
            if(blocksList.includes(p.uid)) return;

            let mediaHtml = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" controls class="feed-media"></video>` : `<img src="${p.media}" class="feed-media">`) : "";
            
            let pollHtml = "";
            if(p.poll) {
                const v0 = p.poll.options[0].votes || 0;
                const v1 = p.poll.options[1].votes || 0;
                pollHtml = `<div style="background:#f1f1f1; padding:10px; border-radius:8px; margin-top:5px;">
                    <b>${p.poll.question}</b><br>
                    <button onclick="vote('${id}', 0)" style="width:100%; margin:5px 0;">${p.poll.options[0].text} (${v0})</button>
                    <button onclick="vote('${id}', 1)" style="width:100%;">${p.poll.options[1].text} (${v1})</button>
                </div>`;
            }

            // Interaction Metrics (Likes and Comments Layout)
            const likesCount = p.likes ? Object.keys(p.likes).length : 0;
            let commentsHtml = "";
            if(p.comments) {
                Object.keys(p.comments).forEach(cId => {
                    commentsHtml += `<div class="comments-list"><b>${p.comments[cId].name}:</b> ${p.comments[cId].text}</div>`;
                });
            }

            cont.innerHTML = `<div class="card">
                <div class="options-dropdown" onclick="triggerSafetyMenu('${id}', '${p.uid}')" style="position: absolute; top: 15px; right: 15px; cursor: pointer;"><i class="fas fa-ellipsis-v"></i></div>
                <b>${p.name}</b> <span class="badge-verified">${p.badge || 'Customer'}</span>
                <p>${p.text}</p>
                ${mediaHtml}
                ${pollHtml}
                <div class="post-actions" style="display: flex; gap: 15px; margin-top: 10px; font-size: 13px; color: #65676b;">
                    <span onclick="likePost('${id}')" style="cursor:pointer;"><i class="fas fa-thumbs-up"></i> Like (${likesCount})</span>
                    <span><i class="fas fa-comment"></i> Comments</span>
                </div>
                <div id="comments-box-${id}">${commentsHtml}</div>
                <div class="comment-box" style="margin-top: 8px; display: flex; gap: 5px;">
                    <input type="text" id="comment-in-${id}" placeholder="Write a comment..." style="margin:0; padding:8px;">
                    <button onclick="submitComment('${id}')" style="padding: 8px 12px; border-radius: 10px; border: none; background: var(--primary); color: white; cursor: pointer;">Send</button>
                </div>
            </div>` + cont.innerHTML;
        });
    });
}

function vote(postId, optIdx) {
    db.ref(`posts/${postId}/poll/options/${optIdx}/votes`).transaction(c => (c || 0) + 1);
}

function likePost(postId) {
    db.ref(`posts/${postId}/likes/${user.uid}`).set(true);
}

function submitComment(postId) {
    const inputField = document.getElementById(`comment-in-${postId}`);
    if(!inputField.value) return;
    db.ref(`posts/${postId}/comments`).push({
        uid: user.uid,
        name: user.name,
        text: inputField.value
    }).then(() => inputField.value = "");
}

function triggerSafetyMenu(postId, targetUid) {
    const action = confirm("Select 'OK' to Report this item, or 'Cancel' to Block this user profile.");
    if(action) {
        db.ref('reports').push({ reporterUid: user.uid, postId: postId, offenderUid: targetUid, timestamp: Date.now() });
        alert("Item logged and sent to moderation handling queue.");
    } else {
        db.ref(`blocks/${user.uid}/${targetUid}`).set(true).then(() => {
            alert("User restricted from profile viewing pathways.");
            location.reload();
        });
    }
}

// --- Smart 4-Field Search and Explicit Access Control Gateway ---
function searchClassmates() {
    const sInst = document.getElementById('s-inst').value.toLowerCase();
    const sYear = document.getElementById('s-year').value;
    const sClass = document.getElementById('s-class').value ? document.getElementById('s-class').value.toLowerCase() : "";
    const sCity = document.getElementById('s-city').value ? document.getElementById('s-city').value.toLowerCase() : "";
    
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(s.key === user.uid || blocksList.includes(s.key)) return;
            
            let matches = true;
            if(sInst && (!u.inst || !u.inst.toLowerCase().includes(sInst))) matches = false;
            if(sYear && u.year != sYear) matches = false;
            if(sClass && (!u.class || !u.class.toLowerCase().includes(sClass))) matches = false;
            if(sCity && (!u.city || !u.city.toLowerCase().includes(sCity))) matches = false;
            
            if(matches) {
                res.innerHTML += `<div class="card">
                    <b>${u.name}</b> <span class="badge-verified">${u.badge || 'Customer'}</span><br>
                    <small>Institution: ${u.inst || 'N/A'} | Year: ${u.year || 'N/A'}</small><br>
                    <small>Class: ${u.class || 'N/A'} | City: ${u.city || 'N/A'}</small>
                    <button onclick="sendFriendRequest('${s.key}')" class="btn-primary" style="margin-top:10px; padding:6px; font-size:12px;">Send Friend Request</button>
                </div>`;
            }
        });
        if(!res.innerHTML) res.innerHTML = "<p>No matching clusters discovered under current filters.</p>";
    });
}

function sendFriendRequest(targetUid) {
    db.ref(`requests/${targetUid}/${user.uid}`).set({
        name: user.name,
        photo: user.photo
    }).then(() => {
        alert("Friend connection message sent securely.");
        sendPushNotificationLog("Inbound matchmaking interaction requested by profile node.");
    });
}

// --- Networking Systems Hub (Requests, Friends Direct Messaging & Auto Cluster Grouping) ---
function loadNetworkingHub() {
    // 1. Monitor incoming handshakes
    db.ref(`requests/${user.uid}`).on('value', snap => {
        const cont = document.getElementById('incoming-requests');
        if(!cont) return;
        cont.innerHTML = "";
        snap.forEach(s => {
            const r = s.val();
            cont.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:5px; border-bottom:1px solid #eee;">
                <span><b>${r.name}</b> requests connection</span>
                <div>
                    <button onclick="acceptRequest('${s.key}', '${r.name}')" class="btn-primary" style="width:auto; padding:5px 10px; background:var(--success); font-size:11px;">Accept</button>
                    <button onclick="rejectRequest('${s.key}')" class="btn-primary" style="width:auto; padding:5px 10px; background:var(--danger); margin-left:5px; font-size:11px;">Deny</button>
                </div>
            </div>`;
        });
    });

    // 2. Verified Friends Messaging List
    db.ref(`friends/${user.uid}`).on('value', snap => {
        const cont = document.getElementById('friends-chat-list');
        if(!cont) return;
        cont.innerHTML = "";
        snap.forEach(s => {
            const f = s.val();
            const chatId = user.uid < s.key ? `${user.uid}_${s.key}` : `${s.key}_${user.uid}`;
            cont.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px; margin-bottom:8px;">
                <span><b>${f.name}</b></span>
                <button onclick="openChat('${chatId}', '${f.name}', 'direct')" class="btn-primary" style="width:auto; padding:5px 15px; font-size:12px;">Chat</button>
            </div>`;
        });
    });

    // 3. Automated Clustering Engine (Auto Batch Group Mapping)
    const groupCont = document.getElementById('auto-groups-list');
    if(groupCont) {
        if(user.inst && user.year && user.class && user.city) {
            const groupSlug = `${user.inst}_${user.year}_${user.class}_${user.city}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
            const groupLabel = `${user.inst.toUpperCase()} (${user.year}) - Class ${user.class.toUpperCase()}`;
            
            groupCont.innerHTML = `<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,123,255,0.05);">
                <span><i class="fas fa-layer-group" style="color:var(--primary)"></i> <b>${groupLabel}</b></span>
                <button onclick="openChat('${groupSlug}', '${groupLabel}', 'group')" class="btn-primary" style="width:auto; padding:5px 15px; background:var(--success); font-size:12px;">Enter Group</button>
            </div>`;
        } else {
            groupCont.innerHTML = "<small style='color:#777;'>Fill your Institution, Year, Class, and City in Profile to join your automatic batch group room.</small>";
        }
    }
}

function acceptRequest(senderUid, senderName) {
    db.ref(`friends/${user.uid}/${senderUid}`).set({ name: senderName });
    db.ref(`friends/${senderUid}/${user.uid}`).set({ name: user.name });
    db.ref(`requests/${user.uid}/${senderUid}`).remove();
}

function rejectRequest(senderUid) {
    db.ref(`requests/${user.uid}/${senderUid}`).remove();
}

function openChat(chatId, title, type) {
    currentChatId = chatId;
    currentChatType = type;
    document.getElementById('chat-title').innerText = title;
    document.getElementById('active-chat-box').style.display = 'block';
    
    const nodePath = type === 'direct' ? `chats/${chatId}` : `group_chats/${chatId}`;
    db.ref(nodePath).off();
    db.ref(nodePath).limitToLast(40).on('value', snap => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            const cssClass = m.senderId === user.uid ? 'sent' : 'received';
            box.innerHTML += `<div class="chat-msg ${cssClass}" style="max-width: 75%; padding: 8px 12px; border-radius: 12px; margin-bottom: 8px; font-size: 13px; display: flex; flex-direction: column;">
                <small style="font-size:9px; opacity:0.7; font-weight:bold; margin-bottom:2px;">${m.senderName}</small>
                <span>${m.text}</span>
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function sendChatMessage() {
    const input = document.getElementById('chatMsgInput');
    if(!input.value || !currentChatId) return;
    
    const msgData = {
        senderId: user.uid,
        senderName: user.name,
        text: input.value,
        timestamp: Date.now()
    };
    
    const nodePath = currentChatType === 'direct' ? `chats/${currentChatId}` : `group_chats/${currentChatId}`;
    db.ref(nodePath).push(msgData).then(() => {
        input.value = "";
    });
}

// --- Academic Reference Library System ---
async function uploadToLibrary() {
    const file = document.getElementById('lib-file').files[0];
    const title = document.getElementById('lib-title').value;
    if(!file || !title) return alert("Select File and Title");
    const base64 = await toBase64(file);
    db.ref('library').push({ title, file: base64, fileName: file.name, uploader: user.name });
    alert("Uploaded!");
}

function loadLibrary() {
    db.ref('library').on('value', snap => {
        const cont = document.getElementById('library-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const d = s.val();
            cont.innerHTML += `<div class="card"><b>${d.title}</b><br><small>By: ${d.uploader}</small><br><a href="${d.file}" download="${d.fileName}" style="color:var(--primary); font-weight:bold;">Download PDF</a></div>`;
        });
    });
}

// --- Auxiliary Services (Events, Mentors, Jobs, QR Engine) ---
function createEvent() {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    const loc = document.getElementById('ev-loc').value;
    if(title && date) {
        db.ref('events').push({ title, date, loc: loc || "N/A", creator: user.name });
        alert("Event Saved!");
    }
}

function loadEvents() {
    db.ref('events').on('value', snap => {
        const cont = document.getElementById('events-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const e = s.val();
            cont.innerHTML += `<div class="card"><b>${e.title}</b><br><small>Execution Date: ${e.date} | Location: ${e.loc || 'N/A'}</small></div>`;
        });
    });
}

function postJob() {
    const title = document.getElementById('job-title').value;
    const comp = document.getElementById('job-comp').value;
    if(title && comp) {
        db.ref('jobs').push({ title, comp, postedBy: user.name }).then(() => {
            alert("Opportunity Posted!");
        });
    }
}

function loadJobs() {
    db.ref('jobs').on('value', snap => {
        const cont = document.getElementById('jobs-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const j = s.val();
            cont.innerHTML += `<div class="card"><b>${j.title}</b> at ${j.comp} <br><small>Posted By: ${j.postedBy}</small></div>`;
        });
    });
}

function loadMentors() {
    db.ref('users').once('value', snap => {
        const cont = document.getElementById('mentor-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(u.skills) cont.innerHTML += `<div class="card"><b>${u.name}</b><br><small>Expertise: ${u.skills}</small></div>`;
        });
    });
}

function generateQRCode() {
    const qrDiv = document.getElementById('qr-code');
    qrDiv.innerHTML = "";
    const qr = qrcode(4, 'L');
    qr.addData(`Connect with ${user.name} via unique UID node mapping.`);
    qr.make();
    qrDiv.innerHTML = qr.createImgTag(4);
}

function shareInvite() {
    const msg = encodeURIComponent(`Join Classmate Connect Global platform to map across historical clusters and track down memories!\nLink: ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}

function sendPushNotificationLog(messageText) {
    // Simulates an FCM system push layer pipeline for foreground updates
    console.log("[Push Notification Processing Engine Log]: " + messageText);
}

// --- Functional Utilities & Profiles ---
function toBase64(file) {
    return new Promise((r, j) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => r(reader.result); reader.onerror = e => j(e);
    });
}

function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        el.classList.add('active-nav');
    }
}

function updateProfile() {
    const d = { 
        name: document.getElementById('p-name').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        class: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value,
        skills: document.getElementById('p-skills').value,
        badge: user.badge
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Data Synchronized"));
}

function toggleDarkMode() { document.body.classList.toggle('dark'); }
function deleteMyData() { if(confirm("Permanently erase your account records?")) { db.ref('users/' + user.uid).remove(); auth.currentUser.delete().then(() => location.reload()); } }
function acceptGDPR() { localStorage.setItem('gdpr_accepted', 'true'); document.getElementById('gdpr-banner').style.display = 'none'; }
if(!localStorage.getItem('gdpr_accepted')) document.getElementById('gdpr-banner').style.display = 'block';
