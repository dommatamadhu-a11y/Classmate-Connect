// ... Firebase Configuration (AIza...) ...

// 1. Theme Engine
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('mode', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}
if(localStorage.getItem('mode') === 'dark') document.body.classList.add('dark-mode');

// 2. AI Career Chatbot Logic
function openAI() { document.getElementById('ai-container').style.display = 'flex'; }
function closeAI() { document.getElementById('ai-container').style.display = 'none'; }

function askAI() {
    const q = document.getElementById('aiInput').value;
    const box = document.getElementById('ai-messages');
    if(!q) return;
    box.innerHTML += `<div style="text-align:right; margin-bottom:10px;"><b>You:</b> ${q}</div>`;
    
    // Simulating AI Response based on User Skills
    setTimeout(() => {
        let reply = `Based on your profile as a student from ${user.inst}, I recommend learning Data Science and advanced ${user.skills || 'Mathematics'}.`;
        box.innerHTML += `<div style="background:var(--border); padding:10px; border-radius:10px; margin-bottom:10px;"><b>AI Mentor:</b> ${reply}</div>`;
        box.scrollTop = box.scrollHeight;
    }, 800);
    document.getElementById('aiInput').value = "";
}

// 3. Dynamic Polls
function createPoll() {
    const q = document.getElementById('pollText').value;
    if(!q) return;
    db.ref('posts').push({
        uid: user.uid, userName: user.name, msg: q, isPoll: true, 
        opt1: "Agree", opt2: "Disagree", v1: 0, v2: 0, time: Date.now()
    });
    document.getElementById('pollText').value = "";
    alert("Poll Created!");
}

function vote(pid, opt) {
    db.ref(`posts/${pid}/${opt}`).transaction(v => (v || 0) + 1);
}

// 4. Enhanced Feed Load
function loadFeed() {
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('feed-container'); cont.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            if(p.isPoll) {
                cont.innerHTML = `
                <div class="card">
                    <b>Poll: ${p.msg}</b>
                    <div class="poll-box" onclick="vote('${s.key}', 'v1')">Agree (${p.v1})</div>
                    <div class="poll-box" onclick="vote('${s.key}', 'v2')">Disagree (${p.v2})</div>
                </div>` + cont.innerHTML;
            } else {
                cont.innerHTML = `
                <div class="card">
                    <div style="font-weight:600; font-size:13px; color:var(--primary);">${p.userName}</div>
                    <p>${p.msg}</p>
                    ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:12px; margin-top:10px;">` : ""}
                </div>` + cont.innerHTML;
            }
        });
    });
}

// 5. WhatsApp Invite (Moved to Settings)
function shareToWhatsApp() {
    const msg = `Hey! I'm using Classmate Connect to reconnect with our batch from ${user.inst}. Join the network here: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}

// 6. Notification Controller
function toggleNotifs() {
    if(document.getElementById('notif-check').checked) {
        Notification.requestPermission().then(p => {
            if(p === 'granted') alert("Notifications Authorized!");
        });
    }
}

// ... Profile Sync, Search, & Auth (Same as before but refined) ...
