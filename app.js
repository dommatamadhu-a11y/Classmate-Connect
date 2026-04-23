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

// 1. Translation Dictionary (Global Level)
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
        delete_data: "Delete My Data"
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
        delete_data: "నా డేటాను తొలగించు"
    }
};

// 2. Auth Listener
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
                skills: d.skills || "" 
            };
            updateUI();
            loadFeed();
            loadFriends();
            loadNotifications();
            autoGroupSync();
            applyLanguage(); // భాషను అప్లై చేస్తుంది
        });
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

// 3. Language & UI Logic
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    applyLanguage();
}

function applyLanguage() {
    const langData = translations[currentLang];
    
    // Update placeholders
    document.querySelectorAll('[data-placeholder]').forEach(el => {
        const key = el.getAttribute('data-placeholder');
        el.placeholder = langData[key];
    });

    // Update inner text
    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if (langData[key]) el.innerText = langData[key];
    });
}

// 4. Post & Media Feed
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-post').files[0];
    const btn = document.getElementById('postBtn');
    
    if(!msg && !file) return;
    
    btn.disabled = true;
    btn.innerText = "...";

    let postData = {
        uid: user.uid,
        userName: user.name,
        userPhoto: user.photo,
        msg: msg,
        time: Date.now()
    };

    if(file) {
        postData.mediaType = file.type.startsWith('video') ? 'video' : 'image';
        postData.media = await toBase64(file);
    }

    db.ref('posts').push(postData).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('f-post').value = "";
        if(document.getElementById('file-name-preview')) 
            document.getElementById('file-name-preview').innerText = "";
        btn.disabled = false;
        btn.innerText = translations[currentLang].post_btn;
    });
}

function loadFeed() {
    db.ref('posts').limitToLast(20).on('value', snap => {
        const cont = document.getElementById('feed-container');
        cont.innerHTML = "";
        let posts = [];
        snap.forEach(s => { posts.push({ id: s.key, ...s.val() }); });
        posts.reverse().forEach(p => {
            let mediaHTML = p.media ? (p.mediaType === 'video' ? `<video src="${p.media}" class="feed-media" controls></video>` : `<img src="${p.media}" class="feed-media">`) : "";
            cont.innerHTML += `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.userPhoto}" style="width:35px; height:35px; border-radius:50%;">
                        <b>${p.userName}</b>
                    </div>
                    <p>${p.msg}</p>
                    ${mediaHTML}
                </div>`;
        });
    });
}

// 5. GDPR & Security
function deleteMyData() {
    if(confirm("Are you sure? This will delete your profile and posts forever.")) {
        db.ref('users/' + user.uid).remove();
        db.ref('posts').orderByChild('uid').equalTo(user.uid).once('value', snap => {
            snap.forEach(s => s.ref.remove());
        });
        alert("Data deleted. Logging out.");
        logout();
    }
}

// 6. Existing Features (Navigation, Chat, Search, Friends)
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el && el.classList.contains('nav-item')) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        el.classList.add('active-nav');
    }
}

function openChat(targetUid, targetName) {
    currentChatUid = targetUid;
    document.getElementById('chat-t-name').innerText = targetName;
    show('chat-window');
    const chatId = user.uid < targetUid ? user.uid + targetUid : targetUid + user.uid;
    db.ref('chats/' + chatId).on('value', snap => {
        const cont = document.getElementById('chat-messages');
        cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            const cls = m.sender === user.uid ? 'msg-sent' : 'msg-received';
            cont.innerHTML += `<div class="${cls}">${m.text}</div>`;
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

function searchClassmates() {
    const inst = document.getElementById('s-inst').value.toLowerCase();
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "";
        snap.forEach(s => {
            const u = s.val();
            if(u.inst && u.inst.toLowerCase().includes(inst) && s.key !== user.uid) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${u.name}</b><br><small>${u.inst} (${u.year})</small></span>
                    <button onclick="sendRequest('${s.key}', '${u.name}')" class="btn-primary" style="width:80px; font-size:12px;">Connect</button>
                </div>`;
            }
        });
    });
}

// 7. Profile & UI Update
function updateProfile() {
    const d = {
        name: document.getElementById('p-name').value,
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        class: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value,
        skills: document.getElementById('p-skills').value
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile & Groups Synced!"));
}

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name.split(' ')[0];
    document.getElementById('lang-selector').value = currentLang;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.class;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
}

// Utilities
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function togglePoll() {
    const ui = document.getElementById('poll-ui');
    ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
}

function toggleDarkMode() { document.body.classList.toggle('dark'); }

function shareInvite() {
    const msg = encodeURIComponent(`Join me on Classmate Connect Global! Let's reconnect. \nLink: ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`);
}

function autoGroupSync() {
    const groupDiv = document.getElementById('auto-groups');
    if(user.inst && user.year) {
        const gName = `${user.inst}_${user.year}`;
        groupDiv.innerHTML = `<div class="card" onclick="openGroupChat('${gName}')" style="cursor:pointer; background:var(--primary); color:white;">
            <i class="fas fa-users"></i> Join ${user.inst} (${user.year})
        </div>`;
    }
}
