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

// Auth Logic
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = 'none';
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", skills: d.skills || "" };
            updateUI();
            loadFeed();
            loadLibrary();
            loadEvents();
            loadMentors();
            loadJobs();
            generateQRCode();
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
    document.getElementById('p-skills').value = user.skills;
}

// Post Management
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
    
    if(!msg && !file && !isPoll) return alert("Empty Post");

    let postData = { uid: user.uid, name: user.name, text: msg, time: Date.now() };

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
    });
}

function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            const id = s.key;
            let mediaHtml = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" controls class="feed-media"></video>` : `<img src="${p.media}" class="feed-media">`) : "";
            let pollHtml = p.poll ? `<div style="background:#eee; padding:10px; border-radius:8px; margin-top:5px;"><b>${p.poll.question}</b><br><button onclick="vote('${id}', 0)" style="width:100%; margin:5px 0;">${p.poll.options[0].text} (${p.poll.options[0].votes || 0})</button><button onclick="vote('${id}', 1)" style="width:100%;">${p.poll.options[1].text} (${p.poll.options[1].votes || 0})</button></div>` : "";
            cont.innerHTML = `<div class="card"><b>${p.name}</b><p>${p.text}</p>${mediaHtml}${pollHtml}</div>` + cont.innerHTML;
        });
    });
}

function vote(postId, optIdx) {
    db.ref(`posts/${postId}/poll/options/${optIdx}/votes`).transaction(c => (c || 0) + 1);
}

// Library Management
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
            cont.innerHTML += `<div class="card"><b>${d.title}</b><br><a href="${d.file}" download="${d.fileName}" style="color:var(--primary); font-weight:bold;">Download PDF</a></div>`;
        });
    });
}

// Search Logic
function searchClassmates() {
    const sInst = document.getElementById('s-inst').value.toLowerCase();
    const sYear = document.getElementById('s-year').value;
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(s.key === user.uid) return;
            if((!sInst || u.inst.toLowerCase().includes(sInst)) && (!sYear || u.year == sYear)) {
                res.innerHTML += `<div class="card"><b>${u.name}</b><br><small>${u.inst}</small></div>`;
            }
        });
    });
}

// QR Code
function generateQRCode() {
    const qrDiv = document.getElementById('qr-code');
    qrDiv.innerHTML = "";
    const qr = qrcode(4, 'L');
    qr.addData(`Connect with ${user.name}`);
    qr.make();
    qrDiv.innerHTML = qr.createImgTag(4);
}

// Events
function createEvent() {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    if(title && date) db.ref('events').push({ title, date, loc: document.getElementById('ev-loc').value });
}

function loadEvents() {
    db.ref('events').on('value', snap => {
        const cont = document.getElementById('events-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const e = s.val();
            cont.innerHTML += `<div class="card"><b>${e.title}</b><br><small>${e.date}</small></div>`;
        });
    });
}

// Jobs & Mentors
function postJob() {
    const title = document.getElementById('job-title').value;
    const comp = document.getElementById('job-comp').value;
    if(title && comp) db.ref('jobs').push({ title, comp, postedBy: user.name });
}

function loadJobs() {
    db.ref('jobs').on('value', snap => {
        const cont = document.getElementById('jobs-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const j = s.val();
            cont.innerHTML += `<div class="card"><b>${j.title}</b> at ${j.comp}</div>`;
        });
    });
}

function loadMentors() {
    db.ref('users').once('value', snap => {
        const cont = document.getElementById('mentor-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(u.skills) cont.innerHTML += `<div class="card"><b>${u.name}</b><br><small>${u.skills}</small></div>`;
        });
    });
}

// WhatsApp
function shareInvite() {
    const msg = encodeURIComponent(`Join Classmate Connect to reconnect with our old friends!\nLink: ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}

// Utils
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
    const d = { name: document.getElementById('p-name').value, inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value, skills: document.getElementById('p-skills').value };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Updated"));
}

function toggleDarkMode() { document.body.classList.toggle('dark'); }
function deleteMyData() { if(confirm("Delete data?")) { db.ref('users/' + user.uid).remove(); auth.currentUser.delete().then(() => location.reload()); } }
function acceptGDPR() { localStorage.setItem('gdpr_accepted', 'true'); document.getElementById('gdpr-banner').style.display = 'none'; }
if(!localStorage.getItem('gdpr_accepted')) document.getElementById('gdpr-banner').style.display = 'block';
