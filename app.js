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

// Translations Dictionary
const translations = {
    en: {
        feed_placeholder: "Share an update...",
        post_btn: "Post",
        library_title: "Library",
        resource_placeholder: "File Title",
        share_btn: "Upload",
        search_title: "Find Peers",
        inst_placeholder: "College Name",
        year_placeholder: "Year",
        search_btn_text: "Search",
        circle_title: "My Friends",
        groups_title: "My Groups",
        msg_placeholder: "Type a message...",
        translate_label: "Auto-translate to English",
        ai_title: "Career AI Assistant",
        ai_subtitle: "Your guide for career & jobs",
        ask_ai_placeholder: "Ask about jobs, skills...",
        ask_btn: "Ask AI",
        ai_thinking: "AI is thinking...",
        profile_update_btn: "Save Profile",
        logout_btn: "Logout",
        settings_title: "Settings",
        dark_mode_btn: "Toggle Dark Mode",
        nav_feed: "Home",
        nav_library: "Library",
        nav_search: "Search",
        nav_circle: "Circle",
        nav_profile: "Me",
        delete_data: "Delete My Data",
        gdpr_text: "We value your privacy. Your data is encrypted.",
        gdpr_btn: "I Agree"
    },
    te: {
        feed_placeholder: "ఏదైనా పంచుకోండి...",
        post_btn: "పోస్ట్",
        library_title: "లైబ్రరీ",
        resource_placeholder: "ఫైల్ పేరు",
        share_btn: "అప్‌లోడ్",
        search_title: "వెతకండి",
        inst_placeholder: "కళాశాల పేరు",
        year_placeholder: "సంవత్సరం",
        search_btn_text: "వెతుకు",
        circle_title: "నా స్నేహితులు",
        groups_title: "నా గ్రూపులు",
        msg_placeholder: "సందేశం రాయండి...",
        translate_label: "తెలుగులోకి అనువదించు",
        ai_title: "కెరీర్ AI అసిస్టెంట్",
        ai_subtitle: "కెరీర్ మరియు ఉద్యోగాల కోసం మీ గైడ్",
        ask_ai_placeholder: "ఉద్యోగాలు, స్కిల్స్ గురించి అడగండి...",
        ask_btn: "అడుగు",
        ai_thinking: "AI ఆలోచిస్తోంది...",
        profile_update_btn: "ప్రొఫైల్ సేవ్",
        logout_btn: "లాగ్ అవుట్",
        settings_title: "సెట్టింగ్స్",
        dark_mode_btn: "డార్క్ మోడ్ మార్చండి",
        nav_feed: "హోమ్",
        nav_library: "లైబ్రరీ",
        nav_search: "సెర్చ్",
        nav_circle: "సర్కిల్",
        nav_profile: "ప్రొఫైల్",
        delete_data: "నా డేటా తొలగించు",
        gdpr_text: "మేము మీ ప్రైవసీని గౌరవిస్తాము. మీ డేటా సురక్షితం.",
        gdpr_btn: "సరే"
    }
};

// Auth State Listener
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = 'none';
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", skills: d.skills || "" };
            updateUI();
            loadFeed();
            loadFriends();
            autoGroupSync();
            applyLanguage();
        });
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

// Multi-language & Translation
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    applyLanguage();
}

function applyLanguage() {
    const data = translations[currentLang];
    document.querySelectorAll('[data-placeholder]').forEach(el => el.placeholder = data[el.getAttribute('data-placeholder')]);
    document.querySelectorAll('[data-key]').forEach(el => el.innerText = data[el.getAttribute('data-key')]);
}

async function translateText(text, target) {
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`);
        const json = await res.json();
        return json.responseData.translatedText;
    } catch(e) { return text; }
}

// Messaging Logic
async function sendChatMessage() {
    const txt = document.getElementById('chatInput').value;
    if(!txt || !currentChatUid) return;
    const chatId = user.uid < currentChatUid ? user.uid + currentChatUid : currentChatUid + user.uid;
    db.ref('chats/' + chatId).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

function openChat(targetUid, targetName) {
    currentChatUid = targetUid;
    document.getElementById('chat-t-name').innerText = targetName;
    show('chat-window');
    const chatId = user.uid < targetUid ? user.uid + targetUid : targetUid + user.uid;
    db.ref('chats/' + chatId).on('value', async snap => {
        const cont = document.getElementById('chat-messages');
        const isAutoTrans = document.getElementById('auto-translate').checked;
        cont.innerHTML = "";
        const msgs = snap.val() ? Object.values(snap.val()) : [];
        for(let m of msgs) {
            let display = m.text;
            if(isAutoTrans && m.sender !== user.uid) display = await translateText(m.text, currentLang);
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            cont.innerHTML += `<div class="${cls}">${display}</div>`;
        }
        cont.scrollTop = cont.scrollHeight;
    });
}

// Career AI Assistant Logic
async function askAI() {
    const input = document.getElementById('aiInput');
    const msg = input.value;
    if(!msg) return;

    const cont = document.getElementById('ai-msgs');
    cont.innerHTML += `<div class="msg-sent">${msg}</div>`;
    input.value = "";
    cont.scrollTop = cont.scrollHeight;

    const thinkingId = "ai-" + Date.now();
    cont.innerHTML += `<div id="${thinkingId}" class="msg-received">${translations[currentLang].ai_thinking}</div>`;

    try {
        // AI Simulation for Career Path
        const responseText = `I am analyzing career options for "${msg}". For a math master's graduate, you should explore Data Science, Actuarial Science, or TGPSC preparation. Full AI intelligence coming soon!`;
        const translatedResponse = await translateText(responseText, currentLang);
        document.getElementById(thinkingId).innerText = translatedResponse;
    } catch (e) {
        document.getElementById(thinkingId).innerText = "AI is offline. Check connection.";
    }
    cont.scrollTop = cont.scrollHeight;
}

// Feed & Post Handling
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    if(!msg && !file) return;
    const postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now() };
    if(file) {
        postData.mediaType = file.type.startsWith('video') ? 'video' : 'image';
        postData.media = await toBase64(file);
    }
    db.ref('posts').push(postData).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('f-post').value = "";
    });
}

function loadFeed() {
    db.ref('posts').limitToLast(15).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            let media = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" class="feed-media" controls></video>` : `<img src="${p.media}" class="feed-media">`) : "";
            cont.innerHTML = `<div class="card"><b>${p.userName}</b><p>${p.msg}</p>${media}</div>` + cont.innerHTML;
        });
    });
}

// Profile & Group Sync
function updateProfile() {
    const d = { 
        name: document.getElementById('p-name').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        skills: document.getElementById('p-skills').value 
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Saved!"));
}

function autoGroupSync() {
    const div = document.getElementById('auto-groups');
    if(user.inst && user.year) {
        div.innerHTML = `<div class="card" style="background:var(--primary); color:white;">Group: ${user.inst} (${user.year})</div>`;
    }
}

// UI Helpers
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el && el.classList.contains('nav-item')) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        el.classList.add('active-nav');
    }
}

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name.split(' ')[0];
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-skills').value = user.skills;
    document.getElementById('lang-selector').value = currentLang;
}

function toggleDarkMode() { document.body.classList.toggle('dark'); }

function toBase64(file) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => res(reader.result);
        reader.onerror = e => rej(e);
    });
}

function acceptGDPR() { 
    localStorage.setItem('gdpr', 'ok'); 
    document.getElementById('gdpr-banner').style.display = 'none'; 
}

function deleteMyData() {
    if(confirm("Permanently delete your account?")) {
        db.ref('users/' + user.uid).remove().then(() => logout());
    }
}

window.onload = () => { if(!localStorage.getItem('gdpr')) document.getElementById('gdpr-banner').style.display = 'block'; };
