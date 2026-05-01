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

// --- 1. Translation Dictionary ---
const translations = {
    en: {
        feed_placeholder: "Share a memory or career update...",
        post_btn: "Post",
        memory_title: "On This Day Memory:",
        search_title: "Find Classmates",
        inst_placeholder: "Institution Name",
        year_placeholder: "Passout Year",
        class_placeholder: "Studying Class",
        city_placeholder: "Institution City",
        search_btn_text: "Search Now",
        circle_title: "Friends List",
        groups_title: "My Class Groups",
        msg_placeholder: "Message...",
        ai_title: "Career AI Assistant",
        ask_ai_placeholder: "Ask about jobs, skills...",
        ask_btn: "Ask AI",
        profile_update_btn: "Update Profile & Sync Groups",
        whatsapp_invite: "Invite via WhatsApp",
        logout_btn: "Logout",
        nav_feed: "Home",
        nav_search: "Search",
        nav_circle: "Circle",
        nav_profile: "Me",
        translate_label: "Auto-translate to English",
        ai_thinking: "AI is thinking...",
        nav_notifications: "Notifications"
    },
    te: {
        feed_placeholder: "జ్ఞాపకాన్ని లేదా కెరీర్ అప్‌డేట్‌ను పంచుకోండి...",
        post_btn: "పోస్ట్",
        memory_title: "ఈ రోజు జ్ఞాపకం:",
        search_title: "క్లాస్‌మేట్స్‌ని వెతకండి",
        inst_placeholder: "సంస్థ పేరు",
        year_placeholder: "పాసవుట్ సంవత్సరం",
        class_placeholder: "చదువుతున్న క్లాస్",
        city_placeholder: "పట్టణం/సిటీ",
        search_btn_text: "వెతకండి",
        circle_title: "స్నేహితుల జాబితా",
        groups_title: "నా క్లాస్ గ్రూపులు",
        msg_placeholder: "సందేశం పంపండి...",
        ai_title: "కెరీర్ AI అసిస్టెంట్",
        ask_ai_placeholder: "జాబ్స్, స్కిల్స్ గురించి అడగండి...",
        ask_btn: "అడుగు",
        profile_update_btn: "ప్రొఫైల్ అప్‌డేట్ & గ్రూప్ సింక్",
        whatsapp_invite: "WhatsApp ద్వారా ఆహ్వానించండి",
        logout_btn: "లాగ్ అవుట్",
        nav_feed: "హోమ్",
        nav_search: "సెర్చ్",
        nav_circle: "సర్కిల్",
        nav_profile: "ప్రొఫైల్",
        translate_label: "తెలుగులోకి అనువదించు",
        ai_thinking: "AI ఆలోచిస్తోంది...",
        nav_notifications: "నోటిఫికేషన్లు"
    }
};

// --- 2. Auth & User Initialization ---
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
            applyLanguage();
        });
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

// --- 3. UI & Language Logic ---
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    applyLanguage();
}

function applyLanguage() {
    const langData = translations[currentLang];
    document.querySelectorAll('[data-placeholder]').forEach(el => el.placeholder = langData[el.getAttribute('data-placeholder')]);
    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if (langData[key]) el.innerText = langData[key];
    });
}

async function translateText(text, target) {
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`);
        const data = await res.json();
        return data.responseData.translatedText;
    } catch(e) { return text; }
}

// --- 4. Post, Media & Polls ---
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    const pollQ = document.getElementById('p-q').value;
    
    if(!msg && !file && !pollQ) return;
    
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg: msg, time: Date.now() };
    
    if(file) {
        postData.mediaType = file.type.startsWith('video') ? 'video' : 'image';
        postData.media = await toBase64(file);
    }
    
    if(pollQ) {
        postData.poll = { question: pollQ, options: [
            { text: document.getElementById('p-1').value, votes: 0 },
            { text: document.getElementById('p-2').value, votes: 0 }
        ]};
    }

    db.ref('posts').push(postData).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('f-post').value = "";
        document.getElementById('p-q').value = "";
        document.getElementById('poll-ui').style.display = 'none';
    });
}

function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        let posts = [];
        snap.forEach(s => posts.push({ id: s.key, ...s.val() }));
        posts.reverse().forEach(p => {
            let mediaHTML = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" class="feed-media" controls></video>` : `<img src="${p.media}" class="feed-media">`) : "";
            cont.innerHTML += `<div class="card"><b>${p.userName}</b><p>${p.msg}</p>${mediaHTML}</div>`;
        });
    });
}

// --- 5. Messaging & AI Bot ---
function openChat(targetUid, targetName) {
    currentChatUid = targetUid;
    document.getElementById('chat-t-name').innerText = targetName;
    show('chat-window');
    const chatId = user.uid < targetUid ? user.uid + targetUid : targetUid + user.uid;
    
    db.ref('chats/' + chatId).on('value', async snap => {
        const cont = document.getElementById('chat-messages');
        const isAutoTrans = document.getElementById('auto-translate').checked;
        cont.innerHTML = "";
        snap.forEach(async s => {
            const m = s.val();
            let display = m.text;
            if(isAutoTrans && m.sender !== user.uid) display = await translateText(m.text, currentLang);
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            cont.innerHTML += `<div class="${cls}">${display}</div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

function sendChatMessage() {
    const txt = document.getElementById('chatInput').value;
    if(!txt || !currentChatUid) return;
    const chatId = user.uid < currentChatUid ? user.uid + currentChatUid : currentChatUid + user.uid;
    db.ref('chats/' + chatId).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

async function askAI() {
    const msg = document.getElementById('aiInput').value;
    if(!msg) return;
    const cont = document.getElementById('ai-msgs');
    cont.innerHTML += `<div class="msg-sent">${msg}</div>`;
    document.getElementById('aiInput').value = "";
    
    const thinkingId = "ai-" + Date.now();
    cont.innerHTML += `<div id="${thinkingId}" class="msg-received">${translations[currentLang].ai_thinking}</div>`;
    
    const prompt = `As a Math expert and career coach, for your query "${msg}", I suggest...`;
    const response = await translateText(prompt, currentLang);
    document.getElementById(thinkingId).innerText = response;
    cont.scrollTop = cont.scrollHeight;
}

// --- 6. Utilities & Notifications ---
function shareInvite() {
    const msg = encodeURIComponent(`Join me on Classmate Connect Global!\nLink: ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`);
}

function updateProfile() {
    const d = {
        name: document.getElementById('p-name').value,
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        class: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value,
        skills: document.getElementById('p-skills').value
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Saved!"));
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

function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el && el.classList.contains('nav-item')) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        el.classList.add('active-nav');
    }
}

function toBase64(file) {
    return new Promise((res) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => res(r.result);
    });
}

function toggleDarkMode() { document.body.classList.toggle('dark'); }

function autoGroupSync() {
    if(user.inst && user.year) {
        document.getElementById('auto-groups').innerHTML = `<div class="card" style="background:var(--primary); color:white;">Joined ${user.inst} (${user.year})</div>`;
    }
}

function loadNotifications() {
    // నోటిఫికేషన్ లాజిక్ ఇక్కడ వస్తుంది
    document.getElementById('notif-list').innerHTML = `<div class="card">No new notifications.</div>`;
}

function loadFriends() {
    // ఫ్రెండ్స్ లిస్ట్ లాజిక్
}

function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(u.inst && u.inst.toLowerCase().includes(inst) && s.key !== user.uid) {
                res.innerHTML += `<div class="card"><b>${u.name}</b> (${u.year})</div>`;
            }
        });
    });
}
