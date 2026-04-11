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

auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: d.name || u.displayName, photo: u.photoURL, inst: d.inst || "", year: d.year || "", uClass: d.uClass || "", city: d.city || "" };
            updateUI(); loadFeed();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function updateUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('u-display').innerText = user.name;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name-input').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-city').value = user.city;
}

// Post Handling
async function handlePost() {
    const msg = document.getElementById('msgInput').value;
    const file = document.getElementById('f-img').files[0];
    if(!msg && !file) return;

    let postData = { uid: user.uid, userName: user.name, userPhoto: user.photo, msg, time: Date.now(), likes: 0 };
    if(file) postData.media = await toBase64(file);

    db.ref('posts').push(postData);
    document.getElementById('msgInput').value = "";
}

// Load Feed with Like & Comment UI
function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val(); const pid = s.key;
            
            // Comments Logic
            let commentsHtml = "";
            if(p.comments) {
                Object.values(p.comments).forEach(c => {
                    commentsHtml += `<div class="comment-item"><b>${c.name}:</b> ${c.text}</div>`;
                });
            }

            cont.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.userPhoto}" style="width:30px; height:30px; border-radius:50%;">
                        <b>${p.userName}</b>
                    </div>
                    <p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" class="post-img">` : ""}
                    
                    <div style="margin-top:10px; display:flex; gap:20px;">
                        <span onclick="likePost('${pid}')" style="cursor:pointer; color:var(--primary); font-weight:600;">
                            <i class="fas fa-heart"></i> ${p.likes || 0} Likes
                        </span>
                        <span style="color:#666;"><i class="fas fa-comment"></i> Comment</span>
                    </div>

                    <div class="comment-box">
                        <div id="comments-${pid}">${commentsHtml}</div>
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <input type="text" id="input-${pid}" placeholder="Write a comment..." style="margin-bottom:0; padding:8px;">
                            <button onclick="addComment('${pid}')" class="btn-primary" style="width:60px; margin-bottom:0; padding:8px;">Send</button>
                        </div>
                    </div>
                </div>` + cont.innerHTML;
        });
    });
}

// Like Function
function likePost(pid) {
    db.ref(`posts/${pid}/likes`).transaction(c => (c || 0) + 1);
}

// Comment Function
function addComment(pid) {
    const text = document.getElementById(`input-${pid}`).value;
    if(!text) return;
    db.ref(`posts/${pid}/comments`).push({ name: user.name, text: text, time: Date.now() });
    document.getElementById(`input-${pid}`).value = "";
}

// Helper Utilities
function show(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}
function toBase64(f) { return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); }); }
function login() { auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut().then(() => location.reload()); }
function saveProfile() {
    const d = { 
        name: document.getElementById('p-name-input').value, 
        inst: document.getElementById('p-inst').value, 
        year: document.getElementById('p-year').value, 
        uClass: document.getElementById('p-class').value, 
        city: document.getElementById('p-city').value 
    };
    db.ref('users/' + user.uid).update(d).then(() => alert("Profile Updated!"));
}
