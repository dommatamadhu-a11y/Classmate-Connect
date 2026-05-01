// Firebase Configuration (మీ పాత వివరాలు)
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

// --- 1. Translation Dictionary (Updated with Translation labels) ---
const translations = {
    en: {
        feed_placeholder: "Share a memory or career update...",
        post_btn: "Post",
        memory_title: "On This Day Memory:",
        library_title: "Digital Library",
        resource_placeholder: "Resource Title",
        share_btn: "Share Resource",
        search_title: "Find Classmates",
        inst_placeholder: "Institution Name",
        year_placeholder: "Passout Year",
        class_placeholder: "Studying Class",
        city_placeholder: "Institution City",
        search_btn_text: "Search Now",
        circle_title: "Friends List",
        groups_title: "My Class Groups",
        msg_placeholder: "Message...",
        ai_title: "Career AI",
        ask_ai_placeholder: "Ask AI...",
        ask_btn: "Ask",
        profile_update_btn: "Update Profile & Sync Groups",
        whatsapp_invite: "Invite via WhatsApp",
        logout_btn: "Logout",
        settings_title: "Settings",
        dark_mode_btn: "Toggle Dark Mode",
        nav_feed: "Feed",
        nav_library: "Library",
        nav_search: "Search",
        nav_circle: "Circle",
        nav_profile: "Profile",
        privacy_link: "Privacy Policy",
        delete_data: "Delete My Data",
        translate_label: "Auto-translate to English",
        ai_thinking: "AI is thinking..."
    },
    te: {
        feed_placeholder: "జ్ఞాపకాన్ని లేదా కెరీర్ అప్‌డేట్‌ను పంచుకోండి...",
        post_btn: "పోస్ట్",
        memory_title: "ఈ రోజు జ్ఞాపకం:",
        library_title: "డిజిటల్ లైబ్రరీ",
        resource_placeholder: "వనరు పేరు",
        share_btn: "షేర్ చేయండి",
        search_title: "క్లాస్‌మేట్స్‌ని వెతకండి",
        inst_placeholder: "సంస్థ పేరు",
        year_placeholder: "పాసవుట్ సంవత్సరం",
        class_placeholder: "చదువుతున్న క్లాస్",
        city_placeholder: "పట్టణం/సిటీ",
        search_btn_text: "వెతకండి",
        circle_title: "స్నేహితుల జాబితా",
        groups_title: "నా క్లాస్ గ్రూపులు",
        msg_placeholder: "సందేశం పంపండి...",
        ai_title: "కెరీర్ AI",
        ask_ai_placeholder: "AI ని అడగండి...",
        ask_btn: "అడుగు",
        profile_update_btn: "ప్రొఫైల్ అప్‌డేట్ & గ్రూప్ సింక్",
        whatsapp_invite: "WhatsApp ద్వారా ఆహ్వానించండి",
        logout_btn: "లాగ్ అవుట్",
        settings_title: "సెట్టింగ్స్",
        dark_mode_btn: "డార్క్ మోడ్ మార్చండి",
        nav_feed: "ఫీడ్",
        nav_library: "లైబ్రరీ",
        nav_search: "సెర్చ్",
        nav_circle: "సర్కిల్",
        nav_profile: "ప్రొఫైల్",
        privacy_link: "ప్రైవసీ పాలసీ",
        delete_data: "నా డేటాను తొలగించు",
        translate_label: "తెలుగులోకి అనువదించు",
        ai_thinking: "AI ఆలోచిస్తోంది..."
    }
};

// --- 2. Auth Listener ---
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
            autoGroupSync();
            applyLanguage();
        });
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

// --- 3. Translation Logic ---
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    applyLanguage();
}

function applyLanguage() {
    const langData = translations[currentLang];
    document.querySelectorAll('[data-placeholder]').forEach(el => {
        el.placeholder = langData[el.getAttribute('data-placeholder')];
    });
    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if (langData[key]) el.innerText = langData[key];
    });
}

// API ద్వారా టెక్స్ట్‌ని అనువదించే ఫంక్షన్
async function translateText(text, target) {
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`);
        const data = await res.json();
        return data.responseData.translatedText;
    } catch(e) { return text; }
}

// --- 4. Messaging & Real-time Translation ---
function openChat(targetUid, targetName) {
    currentChatUid = targetUid;
    document.getElementById('chat-t-name').innerText = targetName;
    show('chat-window');
    const chatId = user.uid < targetUid ? user.uid + targetUid : targetUid + user.uid;
    
    db.ref('chats/' + chatId).on('value', async snap => {
        const cont = document.getElementById('chat-messages');
        const isAutoTrans = document.getElementById('auto-translate') ? document.getElementById('auto-translate').checked : false;
        cont.innerHTML = "";
        
        const msgs = [];
        snap.forEach(s => { msgs.push(s.val()); });

        for(let m of msgs) {
            let display = m.text;
            // ఒకవేళ ఆటో-ట్రాన్స్‌లేట్ ఆన్ లో ఉంటే మరియు మెసేజ్ అవతలి వారిదైతే అనువదిస్తుంది
            if(isAutoTrans && m.sender !== user.uid) {
                display = await translateText(m.text, currentLang);
            }
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            cont.innerHTML += `<div class="${cls}">${display}</div>`;
        }
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

// --- 5. Career AI Logic ---
async function askAI() {
    const input = document.getElementById('aiInput');
    const msg = input.value;
    if(!msg) return;

    const cont = document.getElementById('ai-msgs');
    cont.innerHTML += `<div class="msg-sent">${msg}</div>`;
    input.value = "";
    
    const thinkingId = "ai-" + Date.now();
    cont.innerHTML += `<div id="${thinkingId}" class="msg-received">${translations[currentLang].ai_thinking}</div>`;
    cont.scrollTop = cont.scrollHeight;

    try {
        const prompt = `As a career expert, help with: ${msg}. (For Mathematics postgraduates, consider Data Science or Teaching).`;
        const aiResponse = await translateText(prompt, currentLang);
        document.getElementById(thinkingId).innerText = aiResponse;
    } catch (e) {
        document.getElementById(thinkingId).innerText = "AI Offline.";
    }
    cont.scrollTop = cont.scrollHeight;
}

// --- 6. Core Features (Feed, Profile, UI) ---
function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        let posts = [];
        snap.forEach(s => { posts.push({ id: s.key, ...s.val() }); });
        posts.reverse().forEach(p => {
            let mediaHTML = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" class="feed-media" controls></video>` : `<img src="${p.media}" class="feed-media">`) : "";
            cont.innerHTML += `<div class="card"><b>${p.userName}</b><p>${p.msg}</p>${mediaHTML}</div>`;
        });
    });
}

async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    if(!msg && !file) return;
    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg: msg, time: Date.now() };
    if(file) {
        postData.mediaType = file.type.startsWith('video') ? 'video' : 'image';
        postData.media = await toBase64(file);
    }
    db.ref('posts').push(postData).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('f-post').value = "";
    });
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
    document.getElementById('lang-selector').value = currentLang;
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
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => res(r.result);
        r.onerror = e => rej(e);
    });
}

function toggleDarkMode() { document.body.classList.toggle('dark'); }
function autoGroupSync() {
    if(user.inst && user.year) {
        document.getElementById('auto-groups').innerHTML = `<div class="card" style="background:var(--primary); color:white;">Joined ${user.inst} (${user.year})</div>`;
    }
}
