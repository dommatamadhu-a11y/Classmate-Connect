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
let currentLang = localStorage.getItem('appLang') || 'en';

const translations = {
    en: { feed_placeholder: "Share a memory...", post_btn: "Post", search_title: "Find Classmates", inst_placeholder: "Institution Name", year_placeholder: "Passout Year", class_placeholder: "Studying Class", city_placeholder: "Institution City", search_btn_text: "Search Now", nav_feed: "Home", nav_search: "Search", nav_profile: "Me" },
    te: { feed_placeholder: "జ్ఞాపకాన్ని పంచుకోండి...", post_btn: "పోస్ట్", search_title: "క్లాస్‌మేట్స్‌ని వెతకండి", inst_placeholder: "సంస్థ పేరు", year_placeholder: "పాసవుట్ సంవత్సరం", class_placeholder: "చదువుతున్న క్లాస్", city_placeholder: "పట్టణం/సిటీ", search_btn_text: "వెతకండి", nav_feed: "హోమ్", nav_search: "సెర్చ్", nav_profile: "ప్రొఫైల్" }
};

auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = 'none';
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", class: d.class || "", city: d.city || "", skills: d.skills || "" };
            updateUI();
            loadFeed();
            loadEvents();
            loadJobs();
            loadMentors();
            applyLanguage();
            generateQRCode();
        });
    } else { document.getElementById('login-overlay').style.display = 'flex'; }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

function updateProfile() {
    const d = { name: document.getElementById('p-name').value, inst: document.getElementById('p-inst').value, year: document.getElementById('p-year').value, class: document.getElementById('p-class').value, city: document.getElementById('p-city').value, skills: document.getElementById('p-skills').value };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Updated!"));
}

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name.split(' ')[0];
    document.getElementById('p-img').src = user.photo;
    document.getElementById('profile-name-tag').innerText = user.name;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.class;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
}

// 1. Digital Business Card (QR Code)
function generateQRCode() {
    const qrDiv = document.getElementById('qr-code');
    qrDiv.innerHTML = "";
    const typeNumber = 4;
    const errorCorrectionLevel = 'L';
    const qr = qrcode(typeNumber, errorCorrectionLevel);
    // Information encoded in QR
    const data = `ClassmateConnect: ${user.name} | ${user.inst} | ${user.class}`;
    qr.addData(data);
    qr.make();
    qrDiv.innerHTML = qr.createImgTag(4);
}

// 2. Smart Event Management
function createEvent() {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    const loc = document.getElementById('ev-loc').value;
    if(!title || !date) return;
    db.ref('events').push({ title, date, loc, creator: user.name, creatorId: user.uid });
    alert("Reunion Created!");
}

function loadEvents() {
    db.ref('events').on('value', snap => {
        const cont = document.getElementById('events-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const e = s.val();
            cont.innerHTML += `<div class="card"><b>${e.title}</b><br><small><i class="fas fa-calendar"></i> ${e.date} | <i class="fas fa-map-marker-alt"></i> ${e.loc}</small><br><button class="btn-primary" style="margin-top:5px; padding:5px; font-size:10px;">I'm Interested</button></div>`;
        });
    });
}

// 3. Job & Internship Board
function postJob() {
    const title = document.getElementById('job-title').value;
    const comp = document.getElementById('job-comp').value;
    const type = document.getElementById('job-type').value;
    if(!title || !comp) return;
    db.ref('jobs').push({ title, comp, type, postedBy: user.name });
    alert("Job Posted!");
}

function loadJobs() {
    db.ref('jobs').on('value', snap => {
        const cont = document.getElementById('jobs-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const j = s.val();
            cont.innerHTML += `<div class="card"><span class="job-tag">${j.type}</span><br><b>${j.title}</b> at ${j.comp}<br><small>Referral by: ${j.postedBy}</small></div>`;
        });
    });
}

// 4. Peer-to-Peer Mentorship
function loadMentors() {
    db.ref('users').limitToLast(20).once('value', snap => {
        const cont = document.getElementById('mentor-list');
        cont.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(u.skills && s.key !== user.uid) {
                cont.innerHTML += `<div class="card" onclick="alert('Chat with ${u.name} for mentoring?')"><b>${u.name}</b><br><small>Skills: ${u.skills}</small><br><button style="background:var(--success); color:white; border:none; border-radius:5px; font-size:10px;">Connect as Mentee</button></div>`;
            }
        });
    });
}

// (Existing Search & Feed Logic Remains Same)
function searchClassmates() {
    const sInst = document.getElementById('s-inst').value.toLowerCase();
    const sYear = document.getElementById('s-year').value;
    const sClass = document.getElementById('s-class').value.toLowerCase();
    const sCity = document.getElementById('s-city').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(s.key === user.uid) return;
            let matches = true;
            if(sInst && (!u.inst || !u.inst.toLowerCase().includes(sInst))) matches = false;
            if(sYear && u.year != sYear) matches = false;
            if(sClass && (!u.class || !u.class.toLowerCase().includes(sClass))) matches = false;
            if(sCity && (!u.city || !u.city.toLowerCase().includes(sCity))) matches = false;
            if(matches) res.innerHTML += `<div class="card"><b>${u.name}</b><br><small>${u.inst} | ${u.year} | ${u.class}</small></div>`;
        });
    });
}

function handlePost() {
    const msg = document.getElementById('msgInput').value;
    if(!msg) return;
    db.ref('posts').push({ uid: user.uid, userName: user.name, msg: msg, time: Date.now() });
    document.getElementById('msgInput').value = "";
}

function loadFeed() {
    db.ref('posts').limitToLast(10).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        let posts = [];
        snap.forEach(s => posts.push(s.val()));
        posts.reverse().forEach(p => cont.innerHTML += `<div class="card"><b>${p.userName}</b><p>${p.msg}</p></div>`);
    });
}

// GDPR: Delete Data
function deleteMyData() {
    if(confirm("Permanently delete your profile and posts?")) {
        db.ref('users/' + user.uid).remove();
        auth.currentUser.delete().then(() => location.reload());
    }
}

function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}

function applyLanguage() {
    const d = translations[currentLang];
    document.querySelectorAll('[data-placeholder]').forEach(e => { if(d[e.getAttribute('data-placeholder')]) e.placeholder = d[e.getAttribute('data-placeholder')]; });
    document.querySelectorAll('[data-key]').forEach(e => { if(d[e.getAttribute('data-key')]) e.innerText = d[e.getAttribute('data-key')]; });
}

function changeLanguage(l) { currentLang = l; localStorage.setItem('appLang', l); applyLanguage(); }
function toggleDarkMode() { document.body.classList.toggle('dark'); }
function acceptGDPR() { localStorage.setItem('gdpr_accepted', 'true'); document.getElementById('gdpr-banner').style.display = 'none'; }
if(!localStorage.getItem('gdpr_accepted')) document.getElementById('gdpr-banner').style.display = 'block';
