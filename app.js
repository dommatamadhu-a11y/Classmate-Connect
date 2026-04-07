
// app.js - Firebase v10 Modular + Performance + Offline
const config = {
    apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
    authDomain: "class-connect-b58f0.firebaseapp.com", 
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "class-connect-b58f0",
    storageBucket: "class-connect-b58f0.firebasestorage.app",
    messagingSenderId: "836461719745",
    appId: "1:836461719745:web:f827862e4db4954626a440"
};

const app = FB.app(config);
const db = FB.db(app);
const auth = FB.auth(app);
const provider = new FB.GoogleAuthProvider();

let currentUser = null;
let pollMode = false;
let postListeners = {};

// Auth state
FB.onAuthStateChanged(auth, async (u) => {
    if (u) {
        const userRef = ref(db, `users/${u.uid}`);
        FB.onValue(userRef, (snap) => {
            const data = snap.val() || {};
            currentUser = {
                uid: u.uid,
                name: data.name || u.displayName || "Classmate",
                photoURL: u.photoURL || "https://via.placeholder.com/40?text=ðŸ‘¤",
                institution: data.inst || "",
                year: data.year || "",
                class: data.uClass || "",
                city: data.city || ""
            };
            updateUI();
            loadHomeFeed();
            loadStories();
            loadNotifications();
            loadFriends();
        });
        document.getElementById("login-overlay").style.display = "none";
    } else {
        document.getElementById("login-overlay").style.display = "flex";
    }
});

function updateUI() {
    document.getElementById("header-img").src = currentUser.photoURL;
    document.getElementById("profile-img").src = currentUser.photoURL;
    document.getElementById("user-display").textContent = currentUser.name;
    // Update profile inputs...
    ["profile-name", "profile-institution", "profile-year", "profile-class", "profile-city"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currentUser[id.replace("profile-", "")] || "";
    });
}

function showSection(sectionId, navEl = null) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active-nav"));
    document.getElementById(sectionId).classList.add("active");
    if (navEl) navEl.classList.add("active-nav");
}

function togglePoll() {
    pollMode = !pollMode;
    document.getElementById("poll-controls").style.display = pollMode ? "block" : "none";
}

async function handlePost() {
    const text = document.getElementById("message-input").value.trim();
    const imageFile = document.getElementById("post-image").files[0];
    const groupKey = (currentUser.institution + currentUser.year).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "GLOBAL";

    const postData = {
        uid: currentUser.uid,
        name: currentUser.name,
        photoURL: currentUser.photoURL,
        text,
        timestamp: Date.now(),
        groupKey,
        likes: 0,
        comments: 0
    };

    if (pollMode) {
        postData.poll = {
            question: document.getElementById("poll-question").value.trim(),
            option1: document.getElementById("poll-option1").value.trim(),
            option2: document.getElementById("poll-option2").value.trim(),
            votes1: 0,
            votes2: 0
        };
        togglePoll();
        // Clear poll inputs
    }

    if (imageFile) {
        postData.image = await fileToBase64(imageFile);
    }

    if (text || imageFile || postData.poll) {
        await FB.push(ref(db, "posts"), postData);
        document.getElementById("message-input").value = "";
        document.getElementById("post-image").value = "";
    }
}

function fileToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
    });
}

function loadHomeFeed() {
    const groupKey = (currentUser.institution + currentUser.year).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "GLOBAL";
    const postsRef = query(ref(db, "posts"), orderByChild("groupKey"), equalTo(groupKey), limitToLast(50));
    FB.onValue(postsRef, (snap) => {
        const container = document.getElementById("posts-container");
        container.innerHTML = "";
        snap.forEach((childSnap) => {
            const post = { id: childSnap.key, ...childSnap.val() };
            container.insertAdjacentHTML("beforeend", createPostHTML(post));
        });
    });
}

function createPostHTML(post) {
    const pollHTML = post.poll ? `
        <div style="margin: var(--space-4) 0; padding: var(--space-4); background: var(--surface-2); border-radius: var(--radius-md); border: 1px solid color-mix(in oklch, var(--text) 0.08);">
            <div style="font-weight: 600; margin-bottom: var(--space-2);">${post.poll.question}</div>
            <button class="poll-option" onclick="vote('${post.id}', 'option1')" style="text-align: left;">${post.poll.option1} <span style="float: right; color: var(--text-muted);">${post.poll.votes1 || 0}</span></button>
            <button class="poll-option" onclick="vote('${post.id}', 'option2')" style="text-align: left;">${post.poll.option2} <span style="float: right; color: var(--text-muted);">${post.poll.votes2 || 0}</span></button>
        </div>
    ` : "";

    return `
        <article class="card" style="animation: slideInUp 400ms ease-out;">
            <header style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4);">
                <img src="${post.photoURL}" alt="${post.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" loading="lazy">
                <div>
                    <strong style="font-size: var(--text-sm);">${post.name}</strong>
                    <time style="color: var(--text-muted); font-size: var(--text-xs); display: block;">${new Date(post.timestamp).toLocaleString()}</time>
                </div>
            </header>
            ${post.text ? `<p style="margin-bottom: var(--space-4); white-space: pre-wrap;">${post.text}</p>` : ""}
            ${post.image ? `<img src="${post.image}" alt="Post image" class="post-img" loading="lazy">` : ""}
            ${pollHTML}
            <footer style="display: flex; gap: var(--space-4); padding-top: var(--space-4); border-top: 1px solid color-mix(in oklch, var(--text) 0.08);">
                <button onclick="likePost('${post.id}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: var(--space-1); padding: var(--space-2); border-radius: var(--radius-sm); transition: var(--transition-interactive);">
                    <i class="fas fa-heart" aria-hidden="true"></i>
                    <span>${post.likes || 0}</span>
                </button>
                <button onclick="toggleComments('${post.id}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: var(--space-1); padding: var(--space-2); border-radius: var(--radius-sm);">
                    <i class="fas fa-comment" aria-hidden="true"></i>
                    <span>Comment</span>
                </button>
            </footer>
        </article>
    `;
}

function likePost(postId) {
    const likesRef = ref(db, `posts/${postId}/likes`);
    FB.transaction(likesRef, (currentLikes) => (currentLikes || 0) + 1);
}

function vote(postId, option) {
    const votesRef = ref(db, `posts/${postId}/poll/votes${option.slice(-1)}`);
    FB.transaction(votesRef, (currentVotes) => (currentVotes || 0) + 1);
}

function performSearch() {
    const filters = {
        institution: document.getElementById("search-institution").value.toUpperCase().trim(),
        year: document.getElementById("search-year").value,
        class: document.getElementById("search-class").value.toUpperCase().trim(),
        city: document.getElementById("search-city").value.toUpperCase().trim()
    };

    const usersRef = ref(db, "users");
    FB.onValue(usersRef, (snap) => {
        const results = document.getElementById("search-results");
        results.innerHTML = "";
        let matchCount = 0;
        snap.forEach((userSnap) => {
            if (userSnap.key === currentUser.uid) return;
            const userData = userSnap.val();
            let matches = false;

            Object.entries(filters).forEach(([key, value]) => {
                if (value && (userData[key] || "").toString().toUpperCase().includes(value)) {
                    matches = true;
                }
            });

            if (matches) {
                matchCount++;
                results.innerHTML += `
                    <article class="card" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-4);">
                        <div>
                            <strong>${userData.name || "Unknown"}</strong>
                            <br><small style="color: var(--text-muted);">${userData.institution || ""} | ${userData.class || ""} | ${userData.city || ""}</small>
                        </div>
                        <button onclick="sendFriendRequest('${userSnap.key}', '${userData.name || ""}')" class="btn-primary" style="width: auto; padding: var(--space-2) var(--space-4);">
                            <i class="fas fa-user-plus" aria-hidden="true"></i> Connect
                        </button>
                    </article>
                `;
            }
        });
        if (matchCount === 0) {
            results.innerHTML = '<div class="card" style="text-align: center; color: var(--text-muted);">No classmates found. Try different filters.</div>';
        }
    });
}

function sendFriendRequest(targetUid, targetName) {
    const notifRef = ref(db, `notifications/${targetUid}`);
    FB.push(notifRef, { from: currentUser.name, fromUid: currentUser.uid, type: "friend_request", timestamp: Date.now() });
    // Feedback
    const btn = event.target.closest("button");
    btn.textContent = "Sent!";
    btn.disabled = true;
    setTimeout(() => { btn.textContent = "Connect"; btn.disabled = false; }, 2000);
}

function saveProfile() {
    const updates = {
        name: document.getElementById("profile-name").value.trim(),
        inst: document.getElementById("profile-institution").value.trim(),
        year: document.getElementById("profile-year").value.trim(),
        uClass: document.getElementById("profile-class").value.trim(),
        city: document.getElementById("profile-city").value.trim()
    };

    FB.update(ref(db, `users/${currentUser.uid}`), updates).then(() => {
        // Success feedback
        const btn = event.target;
        const original = btn.textContent;
        btn.textContent = "Saved!";
        btn.style.background = "var(--success)";
        setTimeout(() => {
            btn.textContent = original;
            btn.style.background = "";
        }, 1500);
    });
}

function login() {
    FB.signInWithRedirect(auth, provider);
}

function logout() {
    FB.signOut(auth).then(() => location.reload());
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    // Theme preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.dataset.theme = "dark";
    }
});
