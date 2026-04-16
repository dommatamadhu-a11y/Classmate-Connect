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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const messaging = firebase.messaging();

let user = null;
let currentChatId = null;
let currentGroupId = null;
let pollActive = false;

// Splash Screen Logic: Hides the splash screen after 2 seconds
window.onload = () => { 
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if(splash) splash.style.display = 'none';
    }, 2000); 
};

// Observe User Authentication State
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val() || {};
            user = { 
                uid: u.uid, 
                name: d.name || u.displayName, 
                photo: u.photoURL, 
                inst: d.inst || "", 
                year: d.year || "", 
                uClass: d.uClass || "", 
                city: d.city || "", 
                skills: d.skills || "",
                fcmToken: d.fcmToken || ""
            };
            initApp();
        });
    } else { 
        document.getElementById('login-overlay').style.display = "flex"; 
    }
});

// Initialize Main Application Features
function initApp() {
    updateUI(); 
    loadFeed(); 
    loadLibrary(); 
    loadCircle(); 
    listenNotifs(); 
    checkMemories(); 
    autoGroupAlumni();
    initNotifications(); // Setup Push Notifications
}

// Update User Interface Elements
function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-skills').value = user.skills;
    
    const badge = document.getElementById('u-badge');
    if(user.skills) {
        badge.innerText = user.skills.split(',')[0];
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

// Push Notification Logic with your VAPID Key
function initNotifications() {
    // Your VAPID Key is integrated here
    const myVapidKey = 'BNppuFKd12JLfoyzxiLusI7RKlRZn65W9v4OnTul3hi2JkFJjUrrzNPml6cHaCxHG-fhgCj6cssnA8YExKGFPJM';

    messaging.getToken({ vapidKey: myVapidKey }).then((token) => {
        if (token) {
            if (user.fcmToken !== token) {
                // Update the user's notification token in the database
                db.ref(`users/${user.uid}`).update({ fcmToken: token });
                console.log("FCM Token successfully registered.");
            }
        } else {
            console.warn("No registration token available. Request permission to generate one.");
        }
    }).catch((err) => {
        console.error("An error occurred while retrieving token: ", err);
    });

    // Listener for messages received while the app is in focus
    messaging.onMessage((payload) => {
        console.log("Foreground Message received: ", payload);
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: payload.notification.icon,
        };
        // Display browser notification
        new Notification(notificationTitle, notificationOptions);
    });
}

// Handle Profile Updates and Check Mandatory Fields
function updateProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const uClass = document.getElementById('p-class').value.trim();
    const city = document.getElementById('p-city').value.trim();
    const name = document.getElementById('p-name').value.trim();
    const skills = document.getElementById('p-skills').value.trim();

    // Verification Alert
    if(!inst || !year || !uClass || !city) {
        alert("CRITICAL: Please fill Institution Name, Passout Year, Studying Class, and Institution City to join your classmates' group!");
        return;
    }

    const data = { name, inst, year, uClass, city, skills };
    db.ref('users/' + user.uid).update(data).then(() => {
        alert("Profile Successfully Updated!");
        autoGroupAlumni();
    });
}

// Automatic Group Creation Logic (Using 4 specific filters)
function autoGroupAlumni() {
    if(user.inst && user.year && user.uClass && user.city) {
        // Create a unique group ID by sanitizing the profile inputs
        const gid = `${user.inst}_${user.year}_${user.uClass}_${user.city}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const gName = `${user.inst} (${user.year}) - ${user.uClass}, ${user.city}`;
        
        db.ref(`groups/${gid}/info`).set({ name: gName, id: gid, city: user.city });
        db.ref(`groups/${gid}/members/${user.uid}`).set({ name: user.name, photo: user.photo });
        loadGroupsList();
    }
}

// Load Institutional Groups for the User
function loadGroupsList() {
    db.ref('groups').on('value', snap => {
        const cont = document.getElementById('auto-groups'); 
        cont.innerHTML = "";
        snap.forEach(s => {
            const g = s.val();
            if(g.members && g.members[user.uid]) {
                cont.innerHTML += `
                    <div class="card" onclick="openGroupChat('${s.key}', '${g.info.name}')" style="cursor:pointer; display:flex; align-items:center; gap:12px;">
                        <i class="fas fa-users" style="color:var(--primary); font-size:20px;"></i>
                        <div>
                            <b>${g.info.name}</b><br>
                            <small style="color:#777;">Classmate Group</small>
                        </div>
                    </div>`;
            }
        });
    });
}

// Group Chat UI Logic
function openGroupChat(gid, gname) {
    currentGroupId = gid;
    document.getElementById('g-chat-name').innerText = gname;
    show('group-chat-window');
    db.ref(`group_messages/${gid}`).on('value', snap => {
        const cont = document.getElementById('group-messages'); 
        cont.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); 
            const isMine = m.sender === user.uid;
            cont.innerHTML += `
                <div class="${isMine?'msg-sent':'msg-received'}">
                    <small style="font-size:8px; display:block; opacity:0.8;">${m.senderName}</small>
                    ${m.text}
                </div>`;
        });
        cont.scrollTop = cont.scrollHeight;
    });
}

// Send Message to the Group
function sendGroupMessage() {
    const text = document.getElementById('g-chatInput').value;
    if(!text) return;
    db.ref(`group_messages/${currentGroupId}`).push({ 
        sender: user.uid, 
        senderName: user.name, 
        text: text, 
        time: Date.now() 
    });
    document.getElementById('g-chatInput').value = "";
}

// Navigation Helper
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(el) { 
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); 
        el.classList.add('active-nav'); 
    }
}

// Base64 Conversion for Media Uploads
function toBase64(f) { 
    return new Promise(r => { 
        const rd = new FileReader(); 
        rd.onload = e => r(e.target.result); 
        rd.readAsDataURL(f); 
    }); 
}

// Authentication Helpers
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }

/* Placeholder sections for additional features like Feed, Search, and Library */
function loadFeed() { /* Implementation for Feed logic */ }
function loadLibrary() { /* Implementation for Library logic */ }
function loadCircle() { /* Implementation for Friends logic */ }
function listenNotifs() { /* Implementation for Notification listener */ }
function checkMemories() { /* Implementation for On This Day logic */ }
