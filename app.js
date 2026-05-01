// Firebase Configuration
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
let currentChatUid = null;
let currentLang = localStorage.getItem('appLang') || 'en';

const translations = {
    en: {
        feed_placeholder: "Share a memory or career update...",
        post_btn: "Post",
        memory_title: "On This Day Memory:",
        search_title: "Find Classmates",
        inst_placeholder: "Institution Name",
        year_placeholder: "Passout Year",
        search_btn_text: "Search Now",
        circle_title: "Friends List",
        groups_title: "My Class Groups",
        msg_placeholder: "Message...",
        ai_title: "Career AI Assistant",
        ask_ai_placeholder: "Ask about jobs, skills...",
        ask_btn: "Ask AI",
        nav_feed: "Home",
        nav_search: "Search",
        nav_circle: "Circle",
        nav_profile: "Me",
        translate_label: "Auto-translate to English",
        ai_thinking: "AI is thinking..."
    },
    te: {
        feed_placeholder: "జ్ఞాపకాన్ని లేదా కెరీర్ అప్‌డేట్‌ను పంచుకోండి...",
        post_btn: "పోస్ట్",
        memory_title: "ఈ రోజు జ్ఞాపకం:",
        search_title: "క్లాస్‌మేట్స్‌ని వెతకండి",
        inst_placeholder: "సంస్థ పేరు",
        year_placeholder: "పాసవుట్ సంవత్సరం",
        search_btn_text: "వెతకండి",
        circle_title: "స్నేహితుల జాబితా",
        groups_title: "నా క్లాస్ గ్రూపులు",
        msg_placeholder: "సందేశం పంపండి...",
        ai_title: "కెరీర్ AI అసిస్టెంట్",
        ask_ai_placeholder: "జాబ్స్ గురించి అడగండి...",
        ask_btn: "అడుగు",
        nav_feed: "హోమ్",
        nav_search: "సెర్చ్",
        nav_circle: "సర్కిల్",
        nav_profile: "ప్రొఫైల్",
        translate_label: "తెలుగులోకి అనువదించు",
        ai_thinking: "AI ఆలోచిస్తోంది..."
    }
};

// --- Auth & Profile ---
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = 'none';
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { 
                uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, 
                inst: d.inst || "", year: d.year || "", class: d.class || "",
                city: d.city || "", skills: d.skills || "" 
            };
            updateUI();
            loadFeed();
            loadFriends();
            loadNotifications();
            autoGroupSync();
            checkVerificationStatus();
            applyLanguage();
        });
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

function updateProfile() {
    const d = {
        name: document.getElementById('p-name').value,
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        class: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value,
        skills: document.getElementById('p-skills').value
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Updated!"));
}

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name.split(' ')[0];
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.class;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
}

// --- Features: Verification & Roadmap ---
function requestVerification() {
    const file = document.getElementById('v-doc').files[0];
    if(!file) { alert("Select a document first"); return; }
    db.ref('verifications/' + user.uid).set({ status: 'pending', time: Date.now() });
    alert("Verification request sent!");
}

function checkVerificationStatus() {
    db.ref('verifications/' + user.uid).on('value', snap => {
        const d = snap.val();
        if(d && d.status === 'verified') {
            document.getElementById('v-badge').style.display = 'block';
            document.getElementById('verify-section').style.display = 'none';
        }
    });
}

async function generateRoadmap() {
    if(!user.skills || !user.class) { alert("Complete profile first"); return; }
    const cont = document.getElementById('ai-msgs');
    const tid = "ai-" + Date.now();
    cont.innerHTML += `<div id="${tid}" class="msg-received">Creating roadmap for ${user.class}...</div>`;
    const msg = `Career Roadmap for ${user.class} with skills in ${user.skills}: Month 1-2: Skill Polish. Month 3-4: Projects. Month 5-6: Job Hunting.`;
    const res = await translateText(msg, currentLang);
    document.getElementById(tid).innerText = res;
}

// --- Posts & Media ---
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    const pollQ = document.getElementById('p-q').value;
    if(!msg && !file && !pollQ) return;
    
    let pData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg: msg, time: Date.now() };
    if(file) {
        pData.mediaType = file.type.startsWith('video') ? 'video' : 'image';
        pData.media = await toBase64(file);
    }
    if(pollQ) pData.poll = { question: pollQ, options: [{text: document.getElementById('p-1').value, v:0}, {text: document.getElementById('p-2').value, v:0}] };
    
    db.ref('posts').push(pData).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('p-q').value = "";
        document.getElementById('poll-ui').style.display = 'none';
    });
}

function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        let posts = [];
        snap.forEach(s => posts.push(s.val()));
        posts.reverse().forEach(p => {
            let m = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" class="feed-media" controls></video>` : `<img src="${p.media}" class="feed-media">`) : "";
            cont.innerHTML += `<div class="card"><b>${p.userName}</b><p>${p.msg}</p>${m}</div>`;
        });
    });
}

// --- Chat & Translation ---
function openChat(tUid, tName) {
    currentChatUid = tUid;
    document.getElementById('chat-t-name').innerText = tName;
    show('chat-window');
    const cid = user.uid < tUid ? user.uid + tUid : tUid + user.uid;
    db.ref('chats/' + cid).on('value', async snap => {
        const cont = document.getElementById('chat-messages');
        const auto = document.getElementById('auto-translate').checked;
        cont.innerHTML = "";
        snap.forEach(async s => {
            const m = s.val();
            let txt = m.text;
            if(auto && m.sender !== user.uid) txt = await translateText(m.text, currentLang);
            cont.innerHTML += `<div class="${m.sender === user.uid ? 'msg-sent' : 'msg-received'}">${txt}</div>`;
        });
    });
}

function sendChatMessage() {
    const txt = document.getElementById('chatInput').value;
    if(!txt || !currentChatUid) return;
    const cid = user.uid < currentChatUid ? user.uid + currentChatUid : currentChatUid + user.uid;
    db.ref('chats/' + cid).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

async function translateText(q, target) {
    try {
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=auto|${target}`);
        const d = await r.json();
        return d.responseData.translatedText;
    } catch(e) { return q; }
}

function changeLanguage(l) {
    currentLang = l;
    localStorage.setItem('appLang', l);
    applyLanguage();
}

function applyLanguage() {
    const d = translations[currentLang];
    document.querySelectorAll('[data-placeholder]').forEach(e => e.placeholder = d[e.getAttribute('data-placeholder')]);
    document.querySelectorAll('[data-key]').forEach(e => { if(d[e.getAttribute('data-key')]) e.innerText = d[e.getAttribute('data-key')]; });
}

// --- Utils ---
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); el.classList.add('active-nav'); }
}

function shareInvite() {
    const m = encodeURIComponent(`Join Classmate Connect Global!\n${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${m}`);
}

function toBase64(f) { return new Promise(res => { const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result); }); }
function toggleDarkMode() { document.body.classList.toggle('dark'); }
function autoGroupSync() {
    if(user.inst && user.year) document.getElementById('auto-groups').innerHTML = `<div class="card" style="background:var(--primary); color:white;">Group: ${user.inst} (${user.year})</div>`;
}
function loadNotifications() { document.getElementById('notif-list').innerHTML = `<div class="card">No new notifications.</div>`; }
function loadFriends() {}
function searchClassmates() {}
