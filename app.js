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

// LOGIN RESULT HANDLE
auth.getRedirectResult().catch(err => console.log(err.message));

// AUTH STATE
auth.onAuthStateChanged(u => {
    const overlay = document.getElementById('login-overlay');

    if (u) {
        overlay.style.display = "none";

        // 🔥 CREATE USER IF NOT EXISTS
        db.ref('users/' + u.uid).once('value').then(snap => {
            if (!snap.exists()) {
                db.ref('users/' + u.uid).set({
                    name: u.displayName,
                    email: u.email,
                    photo: u.photoURL,
                    inst: "",
                    year: "",
                    uClass: "",
                    city: ""
                });
            }
        });

        // 🔥 GET USER DATA
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = {
                uid: u.uid,
                name: d.name || u.displayName,
                photo: u.photoURL,
                inst: d.inst || "",
                year: d.year || "",
                uClass: d.uClass || "",
                city: d.city || ""
            };

            updateUI();
            loadFeed();
            loadFriends();
            listenNotifs();
            loadStories();
        });

    } else {
        overlay.style.display = "flex";
    }
});

// LOGIN
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider);
}

// LOGOUT
function logout() {
    auth.signOut().then(() => location.reload());
}

// UI UPDATE
function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;

    document.getElementById('p-name-input').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
}

// NAVIGATION
function show(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active-nav');
}

// POST
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];

    if (!msg && !file) return;

    let media = "";
    if (file) media = await toBase64(file);

    const gKey = ((user.inst || "") + (user.year || ""))
        .replace(/\s/g, '')
        .toUpperCase();

    db.ref('posts').push({
        uid: user.uid,
        userName: user.name,
        userPhoto: user.photo,
        msg,
        media,
        groupKey: gKey,
        time: Date.now(),
        likes: {}
    });

    document.getElementById('msgInput').value = "";
    document.getElementById('f-img').value = "";
}

// FEED
function loadFeed() {
    const gKey = ((user.inst || "") + (user.year || ""))
        .replace(/\s/g, '')
        .toUpperCase();

    db.ref('posts').orderByChild('groupKey').equalTo(gKey).on('value', snap => {
        let html = "";

        snap.forEach(s => {
            const p = s.val();
            const id = s.key;

            const likeCount = p.likes ? Object.keys(p.likes).length : 0;

            html = `
            <div class="card">
                <div style="display:flex;align-items:center;">
                    <img src="${p.userPhoto}" width="30" style="border-radius:50%;margin-right:10px;">
                    <b>${p.userName}</b>
                </div>

                <p>${p.msg || ""}</p>
                ${p.media ? `<img src="${p.media}" class="post-img">` : ""}

                <button onclick="likePost('${id}')">❤️ ${likeCount}</button>
            </div>
            ` + html;
        });

        document.getElementById('post-container').innerHTML = html;
    });
}

// LIKE TOGGLE
function likePost(id) {
    const ref = db.ref(`posts/${id}/likes/${user.uid}`);

    ref.once('value', snap => {
        if (snap.exists()) {
            ref.remove();
        } else {
            ref.set(true);
        }
    });
}

// SEARCH
function search() {
    const inst = document.getElementById('s-inst').value.toUpperCase().trim();
    const yr = document.getElementById('s-year').value;

    db.ref('users').once('value', snap => {
        let html = "";

        snap.forEach(s => {
            const u = s.val();

            if (s.key === user.uid) return;

            if (
                (!inst || u.inst?.toUpperCase().includes(inst)) &&
                (!yr || u.year == yr)
            ) {
                html += `
                <div class="card" style="display:flex;justify-content:space-between;">
                    <span>${u.name}</span>
                    <button onclick="sendReq('${s.key}','${u.name}')">+</button>
                </div>`;
            }
        });

        document.getElementById('search-results').innerHTML = html;
    });
}

// FRIEND REQUEST
function sendReq(uid, name) {
    db.ref(`notifications/${uid}`).push({
        type: "req",
        from: user.name,
        fromUid: user.uid
    });
    alert("Request Sent");
}

// NOTIFICATIONS
function listenNotifs() {
    db.ref('notifications/' + user.uid).on('value', snap => {
        const list = document.getElementById('notif-list');
        const badge = document.getElementById('notif-badge');

        list.innerHTML = "";

        if (snap.exists()) {
            badge.style.display = "block";
            badge.innerText = snap.numChildren();

            snap.forEach(s => {
                const n = s.val();

                list.innerHTML += `
                <div class="card">
                    ${n.from} wants to connect
                    <button onclick="acceptReq('${s.key}','${n.fromUid}','${n.from}')">Accept</button>
                </div>`;
            });

        } else {
            badge.style.display = "none";
        }
    });
}

// ACCEPT REQUEST
function acceptReq(nid, fUid, fName) {
    db.ref(`friends/${user.uid}/${fUid}`).set({ name: fName });
    db.ref(`friends/${fUid}/${user.uid}`).set({ name: user.name });
    db.ref(`notifications/${user.uid}/${nid}`).remove();
}

// FRIENDS
function loadFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        let html = "";

        snap.forEach(s => {
            html += `<div class="card">${s.val().name}</div>`;
        });

        document.getElementById('friends-list').innerHTML = html;
    });
}

// PROFILE SAVE
function saveProfile() {
    db.ref('users/' + user.uid).update({
        name: document.getElementById('p-name-input').value,
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        uClass: document.getElementById('p-class').value,
        city: document.getElementById('p-city').value
    });

    alert("Profile Updated");
}

// STORIES
function loadStories() {
    db.ref('stories').on('value', snap => {
        const list = document.getElementById('story-list');

        list.innerHTML = `<div class="story-circle" onclick="addStory()">+</div>`;

        snap.forEach(s => {
            list.innerHTML += `<div class="story-circle"><img src="${s.val().userPhoto}"></div>`;
        });
    });
}

// ADD STORY
async function addStory() {
    const i = document.createElement('input');
    i.type = 'file';

    i.onchange = async e => {
        const b64 = await toBase64(e.target.files[0]);

        db.ref('stories').push({
            uid: user.uid,
            userPhoto: user.photo,
            content: b64
        });
    };

    i.click();
}

// BASE64
function toBase64(file) {
    return new Promise(res => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.readAsDataURL(file);
    });
}
