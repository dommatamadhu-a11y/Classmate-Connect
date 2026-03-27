// Firebase Configuration
const firebaseConfig = { 
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// User Data from Local Storage
let user = JSON.parse(localStorage.getItem("alumniUser")) || { name: "Anonymous", inst: "", year: "", city: "", groupKey: "" };

window.onload = () => {
    document.getElementById('p-name').value = user.name || "";
    document.getElementById('p-inst').value = user.inst || "";
    document.getElementById('p-year').value = user.year || "";
    document.getElementById('p-city').value = user.city || "";
};

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadFriends();
}

// Save Profile & Generate Group Key
function saveProfile() {
    const name = document.getElementById('p-name').value;
    const inst = document.getElementById('p-inst').value;
    const year = document.getElementById('p-year').value;
    const city = document.getElementById('p-city').value;

    if(!name || !inst || !year) {
        alert("Please fill Name, Institution and Year!");
        return;
    }

    user = {
        name: name,
        inst: inst,
        year: year,
        city: city,
        groupKey: `${inst}_${year}_${city}`.replace(/\s+/g, '').toUpperCase()
    };

    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + user.name).set(user);
    alert("Profile Updated & Group Joined!");
    location.reload(); // Refresh to apply group filter
}

// Send Post with Group Key
function sendPost() {
    const msg = document.getElementById('msgInput').value;
    if(!user.groupKey) {
        alert("Please set your profile first!");
        return;
    }
    if(msg) {
        db.ref('posts').push({
            name: user.name,
            msg: msg,
            groupKey: user.groupKey, // Only same group can see
            time: new Date().toLocaleTimeString()
        });
        document.getElementById('msgInput').value = "";
    }
}

// Delete Post Function
function deletePost(postId) {
    if(confirm("Do you want to delete this post?")) {
        db.ref('posts/' + postId).remove();
    }
}

// Load Friends
function loadFriends() {
    const list = document.getElementById('friends-list');
    const info = document.getElementById('group-info');
    if(!user.groupKey) {
        list.innerHTML = "Complete your profile to see batchmates.";
        return;
    }
    info.innerHTML = `Group: <b>${user.inst} (${user.year})</b>`;
    
    db.ref('users').on('value', snap => {
        list.innerHTML = "";
        snap.forEach(child => {
            const u = child.val();
            if(u.groupKey === user.groupKey && u.name !== user.name) {
                list.innerHTML += `<div class="card"><b>👤 ${u.name}</b><br><span class="group-tag">📍 ${u.city}</span></div>`;
            }
        });
    });
}

// Real-time Posts with Group Filtering & Delete Button
db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container');
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        const postId = c.key;
        
        // Show only posts from the user's specific group
        if(p.groupKey === user.groupKey) {
            let deleteBtn = "";
            // Only show delete button if the post belongs to the current user
            if(p.name === user.name) {
                deleteBtn = `<button onclick="deletePost('${postId}')" style="float:right; background:none; border:none; color:red; cursor:pointer;">🗑️</button>`;
            }

            cont.innerHTML = `
                <div class="card">
                    ${deleteBtn}
                    <b style="color:#007bff;">${p.name}</b><br>
                    <p style="margin:5px 0;">${p.msg}</p>
                    <small style="color:#ccc; font-size:10px;">${p.time}</small>
                </div>` + cont.innerHTML;
        }
    });
});
