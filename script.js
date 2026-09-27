/* ============================================================
   نووا گیم — Script
   Author: Aria Azizi
   v3.0 — SPA + Performance
   ============================================================ */

'use strict';
// @ts-nocheck

/* ═══════════════════════════════════
   ۱. ابزارها
═══════════════════════════════════ */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v === null ? fb : v; } catch { return fb; } },
    set(k, v)  { try { localStorage.setItem(k, v); } catch {} },
    del(k)     { try { localStorage.removeItem(k); } catch {} },
    json(k, fb){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
};

function hashPass(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) + str.charCodeAt(i);
        h = h & h;
    }
    return 'h_' + Math.abs(h).toString(36) + '_' + str.length;
}

function faNum(n) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }

function uid(p = '') { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function timeAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return 'همین الان';
    if (d < 3600) return faNum(Math.floor(d / 60)) + ' دقیقه پیش';
    if (d < 86400) return faNum(Math.floor(d / 3600)) + ' ساعت پیش';
    if (d < 604800) return faNum(Math.floor(d / 86400)) + ' روز پیش';
    try { return new Date(ts).toLocaleDateString('fa-IR'); } catch { return ''; }
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

function parseMentions(text) {
    return text.replace(/@([a-zA-Z][a-zA-Z0-9_]{2,19})/g, (m, u) =>
        `<span class="mention" data-username="${u.toLowerCase()}">@${u}</span>`);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 500 * 1024) { reject('حجم فایل زیاده (حداکثر ۵۰۰KB)'); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/* ═══════════════════════════════════
   ۲. Toast
═══════════════════════════════════ */
let toastTimer;
function toast(msg, duration = 2400) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ═══════════════════════════════════
   ۳. DB (localStorage)
═══════════════════════════════════ */
const DB = {
    K: {
        USERS: 'nova.users', POSTS: 'nova.posts', SESSION: 'nova.session',
        FRIENDS: 'nova.friends', MESSAGES: 'nova.messages', NOTIFS: 'nova.notifs',
        GROUPS: 'nova.groups', ACTIVITY: 'nova.activity'
    },
    getUsers()   { return store.json(this.K.USERS, []); },
    setUsers(v)  { store.set(this.K.USERS, JSON.stringify(v)); },
    getPosts()   { return store.json(this.K.POSTS, []); },
    setPosts(v)  { store.set(this.K.POSTS, JSON.stringify(v)); },
    getSession() { return store.json(this.K.SESSION, null); },
    setSession(v){ store.set(this.K.SESSION, JSON.stringify(v)); },
    clearSession(){ store.del(this.K.SESSION); },
    getFriends() { return store.json(this.K.FRIENDS, {}); },
    setFriends(v){ store.set(this.K.FRIENDS, JSON.stringify(v)); },
    getMessages(){ return store.json(this.K.MESSAGES, []); },
    setMessages(v){ store.set(this.K.MESSAGES, JSON.stringify(v)); },
    getNotifs()  { return store.json(this.K.NOTIFS, []); },
    setNotifs(v) { store.set(this.K.NOTIFS, JSON.stringify(v)); },
    getGroups()  { return store.json(this.K.GROUPS, []); },
    setGroups(v) { store.set(this.K.GROUPS, JSON.stringify(v)); },
    getActivity(){ return store.json(this.K.ACTIVITY, []); },
    setActivity(v){ store.set(this.K.ACTIVITY, JSON.stringify(v)); }
};

/* ═══════════════════════════════════
   ۴. State
═══════════════════════════════════ */
const State = {
    theme: store.get('nova.theme', 'light'),
    perf: store.get('nova.perf', 'auto'),
    fontSize: +store.get('nova.fontSize', 100),
    user: null,
    page: 'home',
    pageData: null,
    postFilter: 'all',
    timeFilter: 'day',
    groupFilter: 'all',
    usersSearch: ''
};

/* ═══════════════════════════════════
   ۵. تشخیص سخت‌افزار
═══════════════════════════════════ */
function detectPerf() {
    let score = 0;
    const cores = navigator.hardwareConcurrency || 2;
    const ram = navigator.deviceMemory || 4;
    const isTouch = matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 1;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let gpuScore = 0;
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl');
        if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            const r = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '').toLowerCase();
            if (r.includes('rtx') || r.includes('apple m')) gpuScore = 3;
            else if (r.includes('radeon rx')) gpuScore = 2;
            else if (r.includes('intel')) gpuScore = -1;
            else if (r.includes('swiftshader') || r.includes('llvmpipe')) gpuScore = -3;
        }
    } catch {}

    if (cores >= 8) score += 3;
    else if (cores >= 6) score += 2;
    else if (cores >= 4) score += 1;
    if (ram >= 8) score += 3;
    else if (ram >= 4) score += 2;
    else if (ram >= 2) score += 1;

    score += gpuScore;
    if (!isTouch) score += 2;
    if (reduce) score -= 4;
    if (innerWidth < 480) score -= 1;

    if (score <= -2) return 'ultra-low';
    if (score <= 1) return 'low';
    if (score <= 3) return 'mid';
    if (score >= 12) return 'ultra';
    return 'high';
}

function applyPerf(tier) {
    document.documentElement.dataset.perf = tier;
}

/* ═══════════════════════════════════
   ۶. تم سه‌حالته
═══════════════════════════════════ */
function applyTheme(theme) {
    let final = theme;
    if (theme === 'auto') {
        const h = new Date().getHours();
        final = (h >= 7 && h < 19) ? 'light' : 'dark';
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('light', final === 'light');
    document.documentElement.classList.toggle('dark', final === 'dark');
    document.documentElement.style.colorScheme = final;
    State.theme = theme;
    store.set('nova.theme', theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = final === 'light' ? '#f5f7fb' : '#0a0a14';

    /* تغییر آیکون دکمه تم */
    const iconPath = $('#themeIconPath');
    if (iconPath) {
        const icons = {
            light: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
            dark: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
            auto: 'M12 3v18M3 12h18M12 3a9 9 0 0 1 0 18'
        };
        iconPath.setAttribute('d', icons[theme] || icons.light);
    }
}

function flipTheme() {
    const order = ['light', 'dark', 'auto'];
    const idx = order.indexOf(State.theme);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);
    toast({ light: '☀️ حالت روز', dark: '🌙 حالت شب', auto: '🌗 حالت خودکار' }[next]);
}

setInterval(() => { if (State.theme === 'auto') applyTheme('auto'); }, 60000);

/* ═══════════════════════════════════
   ۷. سیستم Auth
═══════════════════════════════════ */
function getCurrentUser() {
    const session = DB.getSession();
    if (!session) return null;
    return DB.getUsers().find(u => u.id === session.userId) || null;
}

function registerUser({ username, displayName, password, platform }) {
    const users = DB.getUsers();
    const clean = username.toLowerCase().trim();

    if (!/^[a-z][a-z0-9_]{2,19}$/.test(clean))
        return { ok: false, error: 'نام کاربری فقط با حروف انگلیسی، اعداد یا _ (۳-۲۰ کاراکتر)' };
    if (users.some(u => u.username === clean))
        return { ok: false, error: 'این نام کاربری قبلا گرفته شده' };
    if (password.length < 6)
        return { ok: false, error: 'رمز باید حداقل ۶ کاراکتر باشه' };

    const user = {
        id: uid('u_'),
        username: clean,
        displayName: displayName.trim() || clean,
        passHash: hashPass(password),
        platform: platform || 'pc',
        avatar: null,
        cover: null,
        bio: '',
        title: '', firstName: '', lastName: '',
        birthday: '', website: '',
        favGames: '', favMovies: '',
        instagram: '', telegram: '', discord: '',
        role: 'user',
        verified: false,
        level: 1,
        xp: 0,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        friends: [],
        friendRequests: [],
        blocked: [],
        groups: [],
        social: {}
    };

    users.push(user);
    if (users.length === 1) { user.role = 'admin'; user.verified = true; }
    DB.setUsers(users);
    DB.setSession({ userId: user.id, ts: Date.now() });
    State.user = user;
    return { ok: true, user };
}

function loginUser(username, password) {
    const users = DB.getUsers();
    const clean = username.toLowerCase().trim();
    const user = users.find(u => u.username === clean);

    if (!user) return { ok: false, error: 'کاربری با این نام وجود ندارد' };
    if (user.passHash !== hashPass(password)) return { ok: false, error: 'رمز عبور اشتباه است' };

    user.lastSeen = Date.now();
    DB.setUsers(users);
    DB.setSession({ userId: user.id, ts: Date.now() });
    State.user = user;
    return { ok: true, user };
}

function logoutUser() {
    DB.clearSession();
    State.user = null;
    updateAuthUI();
    closePanel();
    toast('👋 خارج شدی');
}

/* ═══════════════════════════════════
   ۸. به‌روزرسانی UI
═══════════════════════════════════ */
function updateAuthUI() {
    const u = State.user;
    const guest = $('#userBtnGuest');
    const logged = $('#userBtn');
    const avatar = $('#navAvatar');
    const name = $('#navName');
    const createBtn = $('#createPostBtn');
    const chatBtn = $('#chatBtn');
    const notifBtn = $('#notifBtn');
    const drawerUser = $('#drawerUser');
    const drawerAvatar = $('#drawerAvatar');
    const drawerName = $('#drawerName');
    const drawerUsername = $('#drawerUsername');
    const drawerLogin = $('#drawerLoginBtn');
    const createGroupBtn = $('#createGroupBtn');

    if (!guest || !logged) return;

    if (u) {
        guest.hidden = true;
        logged.hidden = false;
        if (name) name.textContent = u.displayName;

        const initial = (u.displayName || 'U')[0].toUpperCase();
        if (avatar) {
            avatar.innerHTML = u.avatar ? `<img src="${u.avatar}">` : initial;
        }

        const canPost = u.role === 'admin' || u.role === 'editor' || u.role === 'author';
        if (createBtn) createBtn.hidden = !canPost;
        if (chatBtn) chatBtn.hidden = false;
        if (notifBtn) notifBtn.hidden = false;

        if (drawerUser) drawerUser.hidden = false;
        if (drawerAvatar) drawerAvatar.innerHTML = u.avatar ? `<img src="${u.avatar}">` : initial;
        if (drawerName) drawerName.textContent = u.displayName;
        if (drawerUsername) drawerUsername.textContent = '@' + u.username;
        if (drawerLogin) drawerLogin.hidden = true;
        if (createGroupBtn) createGroupBtn.hidden = u.role !== 'admin';

        updateBadges();
    } else {
        guest.hidden = false;
        logged.hidden = true;
        if (createBtn) createBtn.hidden = true;
        if (chatBtn) chatBtn.hidden = true;
        if (notifBtn) notifBtn.hidden = true;
        if (drawerUser) drawerUser.hidden = true;
        if (drawerLogin) drawerLogin.hidden = false;
        if (createGroupBtn) createGroupBtn.hidden = true;
    }
}

function updateBadges() {
    if (!State.user) return;
    const notifBadge = $('#notifBadge');
    const chatBadge = $('#chatBadge');
    const upNotifCount = $('#upNotifCount');
    const upMsgCount = $('#upMsgCount');
    const upFriendCount = $('#upFriendCount');

    const notifs = DB.getNotifs().filter(n => n.userId === State.user.id && !n.read);
    const msgs = DB.getMessages().filter(m => m.to === State.user.id && !m.read);
    const reqs = (State.user.friendRequests || []).length;

    if (notifBadge) { notifBadge.hidden = notifs.length === 0; notifBadge.textContent = faNum(notifs.length); }
    if (chatBadge)  { chatBadge.hidden = msgs.length === 0; chatBadge.textContent = faNum(msgs.length); }
    if (upNotifCount) { upNotifCount.hidden = notifs.length === 0; upNotifCount.textContent = faNum(notifs.length); }
    if (upMsgCount)   { upMsgCount.hidden = msgs.length === 0; upMsgCount.textContent = faNum(msgs.length); }
    if (upFriendCount){ upFriendCount.hidden = reqs === 0; upFriendCount.textContent = faNum(reqs); }
}

/* ═══════════════════════════════════
   ۹. ناوبری SPA
═══════════════════════════════════ */
function showPage(page, data = null) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');

    State.page = page;
    State.pageData = data;

    /* اسکرول به بالا */
    window.scrollTo({ top: 0, behavior: 'instant' });

    /* رندر صفحه */
    if (page === 'home')     renderHome();
    if (page === 'post')     renderPostPage(data);
    if (page === 'groups')   renderGroupsPage();
    if (page === 'group')    renderGroupPage(data);
    if (page === 'users')    renderUsersPage();
    if (page === 'activity') renderActivityPage();

    /* آپدیت title */
    const titles = {
        home: 'نووا گیم', post: 'پست', groups: 'گروه‌ها',
        group: 'چت گروه', users: 'کاربران', activity: 'فعالیت‌ها',
        about: 'درباره ما', cinema: 'سینما', games: 'بازی'
    };
    document.title = (titles[page] || 'نووا گیم') + ' | Nova Game';
}

/* ═══════════════════════════════════
   ۱۰. رندر صفحه اصلی
═══════════════════════════════════ */
function renderHome() {
    renderPosts();
    renderTrending();
    renderHomeGroups();
}

function getFilteredPosts() {
    let posts = DB.getPosts().filter(p => p.status === 'published');

    switch (State.postFilter) {
        case 'editor':
            posts = posts.filter(p => p.editorChoice === true);
            break;
        case 'discussed':
            posts = posts.slice().sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
            break;
        case 'popular':
            posts = posts.slice().sort((a, b) => (b.likes || 0) - (a.likes || 0));
            break;
        default:
            posts = posts.slice().sort((a, b) => b.createdAt - a.createdAt);
    }
    return posts;
}

function renderPosts() {
    const grid = $('#postsGrid');
    if (!grid) return;

    const posts = getFilteredPosts();

    if (!posts.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌱</div>
                <h3>هنوز پستی نیست</h3>
                <p>وقتی اولین پست منتشر بشه، اینجا نشون داده می‌شه</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    posts.slice(0, 12).forEach(p => grid.appendChild(createPostCard(p)));
}

function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.dataset.id = post.id;

    const catLabel = { news: 'خبر', review: 'نقد', guide: 'راهنما', cinema: 'سینما', game: 'بازی' }[post.category] || 'خبر';

    const coverHtml = post.cover
        ? `<img src="${post.cover}" alt="">`
        : '';

    const scoreHtml = post.score ? `<span class="post-card-badge" style="left:10px;right:auto;">⭐ ${faNum(post.score)}</span>` : '';

    card.innerHTML = `
        <div class="post-card-cover" style="${!post.cover ? 'background:linear-gradient(135deg,var(--accent),var(--accent-2));' : ''}">
            ${coverHtml}
            <span class="post-card-badge">${catLabel}</span>
            ${scoreHtml}
        </div>
        <div class="post-card-body">
            <h3 class="post-card-title">${escapeHtml(post.title)}</h3>
            <p class="post-card-excerpt">${escapeHtml(post.excerpt || stripHtml(post.content).slice(0, 120))}</p>
            <div class="post-card-meta">
                <span>${timeAgo(post.createdAt)}</span>
                <span>·</span>
                <span>${faNum(post.views || 0)} بازدید</span>
                <span>·</span>
                <span>${faNum((post.comments || []).length)} نظر</span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => showPage('post', post.id));
    return card;
}

function renderTrending() {
    const grid = $('#trendingGrid');
    if (!grid) return;

    let posts = DB.getPosts().filter(p => p.status === 'published');
    const now = Date.now();
    const ranges = { day: 86400000, week: 604800000, month: 2592000000 };
    const range = ranges[State.timeFilter] || ranges.day;

    posts = posts.filter(p => (now - p.createdAt) < range);
    posts = posts.slice().sort((a, b) => (b.views || 0) - (a.views || 0));

    if (!posts.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>چیزی برای نمایش نیست</h3>
                <p>توی این بازه زمانی پستی منتشر نشده</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    posts.slice(0, 6).forEach(p => grid.appendChild(createPostCard(p)));
}

function renderHomeGroups() {
    const grid = $('#homeGroupsGrid');
    if (!grid) return;

    const groups = DB.getGroups().filter(g => g.type === 'public').slice(0, 3);

    if (!groups.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>هنوز گروهی نیست</h3>
                <p>اولین گروه رو بساز!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    groups.forEach(g => grid.appendChild(createGroupCard(g)));
}

/* ═══════════════════════════════════
   ۱۱. رندر صفحه پست + کامنت
═══════════════════════════════════ */
function renderPostPage(postId) {
    const box = $('#postPageContent');
    if (!box) return;

    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) { box.innerHTML = '<p>پست پیدا نشد</p>'; return; }

    /* افزایش بازدید */
    post.views = (post.views || 0) + 1;
    DB.setPosts(posts);

    const catLabel = { news: 'خبر', review: 'نقد', guide: 'راهنما', cinema: 'سینما', game: 'بازی' }[post.category] || 'خبر';

    const comments = post.comments || [];

    box.innerHTML = `
        ${post.cover ? `<div class="post-page-cover"><img src="${post.cover}" alt=""></div>` : ''}

        <div class="post-page-header">
            <span class="post-page-cat">${catLabel}${post.score ? ` · ${faNum(post.score)}/۱۰` : ''}${post.editorChoice ? ' · ⭐ سردبیر' : ''}</span>
            <h1 class="post-page-title">${escapeHtml(post.title)}</h1>
            <div class="post-page-meta">
                <div class="author">
                    <div class="user-avatar">${post.authorAvatar ? `<img src="${post.authorAvatar}">` : (post.authorName || 'N')[0]}</div>
                    <strong>${escapeHtml(post.authorName || 'ناشناس')}</strong>
                </div>
                <span>·</span>
                <span>${timeAgo(post.createdAt)}</span>
                <span>·</span>
                <span>${faNum(post.views)} بازدید</span>
            </div>
        </div>

        <div class="post-page-body">${post.content}</div>

        <div class="comments-section">
            <div class="comments-head">
                <h3>💬 نظرات <span>(${faNum(comments.length)})</span></h3>
            </div>

            ${State.user ? `
                <div class="comment-form">
                    <div class="comment-editor" id="commentEditor" contenteditable="true" data-placeholder="نظرت رو بنویس..."></div>

                    <div class="comment-toolbar">
                        <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                        <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                        <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
                        <span class="sep"></span>
                        <button type="button" id="btnSpoiler" title="اسپویلر">👁️</button>
                        <button type="button" id="btnCode" title="کد">&lt;/&gt;</button>
                        <span class="sep"></span>
                        <button type="button" id="btnMention" title="منشن">@</button>
                        <span class="sep"></span>
                        <button type="button" id="btnColorPicker" title="رنگ">🎨</button>
                    </div>

                    <div class="color-picker" id="colorPicker" hidden style="margin-top:8px;">
                        <div class="color-dot" style="background:#0a0f1e;" data-color="#0a0f1e"></div>
                        <div class="color-dot" style="background:#dc2626;" data-color="#dc2626"></div>
                        <div class="color-dot" style="background:#ea580c;" data-color="#ea580c"></div>
                        <div class="color-dot" style="background:#d97706;" data-color="#d97706"></div>
                        <div class="color-dot" style="background:#16a34a;" data-color="#16a34a"></div>
                        <div class="color-dot" style="background:#2563eb;" data-color="#2563eb"></div>
                        <div class="color-dot" style="background:#7c3aed;" data-color="#7c3aed"></div>
                        <div class="color-dot" style="background:#d1006b;" data-color="#d1006b"></div>
                        <input type="color" id="colorPickerCustom" title="رنگ دلخواه" style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;padding:0;">
                    </div>

                    <div class="comment-actions">
                        <small style="font-size:11px;color:var(--tx-mute);">
                            <span id="charCount">۰</span> کاراکتر
                        </small>
                        <button class="btn-primary small" id="submitComment">
                            <span>ارسال</span>
                        </button>
                    </div>
                </div>
            ` : `
                <div class="comment-form" style="text-align:center;padding:24px;">
                    <p style="font-size:13px;color:var(--tx-mute);">برای کامنت گذاشتن اول وارد شو</p>
                    <button class="btn-primary small" id="loginToComment" style="margin-top:10px;">ورود</button>
                </div>
            `}

            <div class="comment-list" id="commentList">
                ${comments.length ? comments.map(c => renderComment(c, post.id)).join('') : '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">هنوز نظری نیست. اولین نفر باش!</p>'}
            </div>
        </div>
    `;

    /* Event Listeners */
    initCommentEditor(postId);
}

function renderComment(comment, postId, parentId = null) {
    const user = DB.getUsers().find(u => u.id === comment.userId);
    const name = user?.displayName || comment.userName || 'ناشناس';
    const avatar = user?.avatar || comment.userAvatar;
    const initial = name[0].toUpperCase();

    const userLiked = (comment.likes || []).includes(State.user?.id);
    const userDisliked = (comment.dislikes || []).includes(State.user?.id);

    const likes = comment.likes || [];
    const dislikes = comment.dislikes || [];

    const reactionsHtml = (likes.length || dislikes.length) ? `
        <div class="reactions-list">
            ${likes.slice(0, 5).map(uid => {
                const u = DB.getUsers().find(x => x.id === uid);
                if (!u) return '';
                const init = (u.displayName || 'U')[0].toUpperCase();
                return `<div class="reaction-avatar" title="${escapeHtml(u.displayName)}">${u.avatar ? `<img src="${u.avatar}">` : init}</div>`;
            }).join('')}
            ${likes.length > 5 ? `<span class="reaction-count">+${faNum(likes.length - 5)}</span>` : ''}
            ${likes.length ? `<span class="reaction-count">${faNum(likes.length)} لایک</span>` : ''}
        </div>
    ` : '';

    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-item-header">
                <div class="user-avatar">${avatar ? `<img src="${avatar}">` : initial}</div>
                <div class="user-name">
                    <strong>${escapeHtml(name)}</strong>
                    <small>@${escapeHtml(user?.username || 'user')}</small>
                </div>
                <span class="time">${timeAgo(comment.createdAt)}</span>
            </div>

            <div class="comment-item-body">${comment.content}</div>

            <div class="comment-item-footer">
                <button class="comment-btn ${userLiked ? 'liked' : ''}" data-like="${comment.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    <span>${faNum(likes.length)}</span>
                </button>
                <button class="comment-btn ${userDisliked ? 'disliked' : ''}" data-dislike="${comment.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                    <span>${faNum(dislikes.length)}</span>
                </button>
                <button class="comment-btn" data-reply="${comment.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>پاسخ</span>
                </button>
                ${State.user && (State.user.id === comment.userId || State.user.role === 'admin') ? `
                    <button class="comment-btn" data-delete="${comment.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                ` : ''}
            </div>

            ${reactionsHtml}

            ${comment.replies?.length ? `
                <div class="comment-replies">
                    ${comment.replies.map(r => renderComment(r, postId, comment.id)).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function initCommentEditor(postId) {
    const editor = $('#commentEditor');
    const submitBtn = $('#submitComment');
    const charCount = $('#charCount');

    if (!editor) return;

    /* Toolbar */
    $$('.comment-toolbar button[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    /* Spoiler */
    $('#btnSpoiler')?.addEventListener('click', () => {
        const sel = window.getSelection();
        const text = sel.toString() || 'متن مخفی';
        document.execCommand('insertHTML', false, `<span class="spoiler" onclick="this.classList.toggle('revealed')">${escapeHtml(text)}</span>`);
        editor.focus();
    });

    /* Code */
    $('#btnCode')?.addEventListener('click', () => {
        const text = prompt('کد:');
        if (text) document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`);
        editor.focus();
    });

    /* Mention */
    $('#btnMention')?.addEventListener('click', () => {
        showMentionDropdown(editor);
    });

    /* Color picker toggle */
    $('#btnColorPicker')?.addEventListener('click', () => {
        const picker = $('#colorPicker');
        if (picker) picker.hidden = !picker.hidden;
    });

    /* Color dots */
    $$('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.execCommand('foreColor', false, dot.dataset.color);
            editor.focus();
        });
    });

    /* Custom color */
    $('#colorPickerCustom')?.addEventListener('input', (e) => {
        document.execCommand('foreColor', false, e.target.value);
        editor.focus();
    });

    /* Character count */
    editor.addEventListener('input', () => {
        if (charCount) charCount.textContent = faNum(editor.textContent.length);
    });

    /* Submit */
    submitBtn?.addEventListener('click', () => {
        const content = editor.innerHTML.trim();
        if (!content || editor.textContent.trim().length < 2) {
            toast('❌ نظرت خیلی کوتاهه');
            return;
        }
        addComment(postId, content);
        editor.innerHTML = '';
        if (charCount) charCount.textContent = '۰';
        toast('✅ نظرت ثبت شد');
    });

    /* Like/Dislike/Reply/Delete */
    document.addEventListener('click', (e) => {
        const like = e.target.closest('[data-like]');
        const dislike = e.target.closest('[data-dislike]');
        const reply = e.target.closest('[data-reply]');
        const del = e.target.closest('[data-delete]');
        const mention = e.target.closest('.mention');

        if (like) { toggleCommentLike(postId, like.dataset.like, 'like'); }
        if (dislike) { toggleCommentLike(postId, dislike.dataset.dislike, 'dislike'); }
        if (reply) { replyToComment(postId, reply.dataset.reply); }
        if (del) {
            if (confirm('حذف بشه؟')) deleteComment(postId, del.dataset.delete);
        }
        if (mention) {
            const u = mention.dataset.username;
            const target = DB.getUsers().find(x => x.username === u);
            if (target) toast('👤 ' + target.displayName);
        }
    });
}

function addComment(postId, content) {
    if (!State.user) return;
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    post.comments = post.comments || [];
    post.comments.push({
        id: uid('c_'),
        userId: State.user.id,
        userName: State.user.displayName,
        userAvatar: State.user.avatar,
        content: parseMentions(content),
        createdAt: Date.now(),
        likes: [],
        dislikes: [],
        replies: []
    });

    DB.setPosts(posts);

    /* Activity */
    addActivity('comment', `${State.user.displayName} روی پست «${post.title}» نظر داد`);

    /* Notification for post author */
    if (post.authorId !== State.user.id) {
        const notifs = DB.getNotifs();
        notifs.push({
            id: uid('n_'),
            userId: post.authorId,
            type: 'comment',
            text: `${State.user.displayName} روی پستت نظر داد`,
            link: `post:${post.id}`,
            ts: Date.now(),
            read: false
        });
        DB.setNotifs(notifs);
    }

    renderPostPage(postId);
}

function toggleCommentLike(postId, commentId, type) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    function findComment(list) {
        for (const c of list) {
            if (c.id === commentId) return c;
            if (c.replies?.length) {
                const found = findComment(c.replies);
                if (found) return found;
            }
        }
        return null;
    }

    const comment = findComment(post.comments || []);
    if (!comment) return;

    comment.likes = comment.likes || [];
    comment.dislikes = comment.dislikes || [];

    if (type === 'like') {
        comment.dislikes = comment.dislikes.filter(id => id !== State.user.id);
        if (comment.likes.includes(State.user.id)) {
            comment.likes = comment.likes.filter(id => id !== State.user.id);
        } else {
            comment.likes.push(State.user.id);
        }
    } else {
        comment.likes = comment.likes.filter(id => id !== State.user.id);
        if (comment.dislikes.includes(State.user.id)) {
            comment.dislikes = comment.dislikes.filter(id => id !== State.user.id);
        } else {
            comment.dislikes.push(State.user.id);
        }
    }

    DB.setPosts(posts);
    renderPostPage(postId);
}

function replyToComment(postId, commentId) {
    const text = prompt('پاسخت رو بنویس:');
    if (!text || !text.trim()) return;

    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    function findComment(list) {
        for (const c of list) {
            if (c.id === commentId) return c;
            if (c.replies?.length) {
                const found = findComment(c.replies);
                if (found) return found;
            }
        }
        return null;
    }

    const comment = findComment(post.comments || []);
    if (!comment) return;

    comment.replies = comment.replies || [];
    comment.replies.push({
        id: uid('c_'),
        userId: State.user.id,
        userName: State.user.displayName,
        userAvatar: State.user.avatar,
        content: escapeHtml(text),
        createdAt: Date.now(),
        likes: [],
        dislikes: [],
        replies: []
    });

    DB.setPosts(posts);
    renderPostPage(postId);
}

function deleteComment(postId, commentId) {
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    function removeFrom(list) {
        const idx = list.findIndex(c => c.id === commentId);
        if (idx > -1) { list.splice(idx, 1); return true; }
        for (const c of list) {
            if (c.replies?.length && removeFrom(c.replies)) return true;
        }
        return false;
    }

    if (removeFrom(post.comments || [])) {
        DB.setPosts(posts);
        renderPostPage(postId);
        toast('🗑 حذف شد');
    }
}

/* ═══════════════════════════════════
   ۱۲. Mention Dropdown
═══════════════════════════════════ */
function showMentionDropdown(editor) {
    const dd = $('#mentionDropdown');
    if (!dd) return;

    const users = DB.getUsers().slice(0, 10);
    if (!users.length) return;

    dd.innerHTML = users.map(u => `
        <div class="mention-item" data-username="${u.username}">
            <div class="user-avatar">${u.avatar ? `<img src="${u.avatar}">` : u.displayName[0]}</div>
            <strong>${escapeHtml(u.displayName)}</strong>
            <small>@${escapeHtml(u.username)}</small>
        </div>
    `).join('');

    const rect = editor.getBoundingClientRect();
    dd.style.top = (rect.bottom + 6) + 'px';
    dd.style.right = (innerWidth - rect.right) + 'px';
    dd.classList.add('on');

    $$('.mention-item', dd).forEach(item => {
        item.addEventListener('click', () => {
            document.execCommand('insertHTML', false, `@${item.dataset.username} `);
            dd.classList.remove('on');
            editor.focus();
        });
    });

    setTimeout(() => {
        document.addEventListener('click', function hide(e) {
            if (!dd.contains(e.target)) {
                dd.classList.remove('on');
                document.removeEventListener('click', hide);
            }
        });
    }, 100);
}

/* ═══════════════════════════════════
   ۱۳. گروه‌ها
═══════════════════════════════════ */
function renderGroupsPage() {
    const grid = $('#groupsGrid');
    if (!grid) return;

    let groups = DB.getGroups();

    if (State.groupFilter === 'public') groups = groups.filter(g => g.type === 'public');
    if (State.groupFilter === 'private') groups = groups.filter(g => g.type === 'private');
    if (State.groupFilter === 'mine') {
        if (!State.user) groups = [];
        else groups = groups.filter(g => (State.user.groups || []).includes(g.id));
    }

    if (!groups.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>گروهی نیست</h3>
                <p>${State.user?.role === 'admin' ? 'اولین گروه رو بساز' : 'به‌زودی گروه‌ها اضافه می‌شن'}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    groups.forEach(g => grid.appendChild(createGroupCard(g)));
}

function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'group-card';

    const membersCount = (group.members || []).length;
    const typeLabel = group.type === 'public' ? '🌍 عمومی' : '🔒 خصوصی';

    card.innerHTML = `
        <div class="group-card-cover" style="${group.cover ? `background:url('${group.cover}') center/cover;` : ''}">
            <span class="group-card-type ${group.type}">${typeLabel}</span>
        </div>
        <div class="group-card-body">
            <div class="group-card-avatar">${group.avatar ? `<img src="${group.avatar}">` : (group.name || 'G')[0].toUpperCase()}</div>
            <div class="group-card-info">
                <h3>${escapeHtml(group.name)}</h3>
                <p>${faNum(membersCount)} عضو · ${faNum((group.messages || []).length)} پیام</p>
            </div>
        </div>
    `;

    card.addEventListener('click', () => showPage('group', group.id));
    return card;
}

function renderGroupPage(groupId) {
    const box = $('#groupPageContent');
    if (!box) return;

    const groups = DB.getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) { box.innerHTML = '<p>گروه پیدا نشد</p>'; return; }

    const isMember = State.user && (group.members || []).includes(State.user.id);
    const isOwner = State.user && group.ownerId === State.user.id;
    const isAdmin = State.user && (group.admins || []).includes(State.user.id);
    const isMod = State.user && (group.mods || []).includes(State.user.id);
    const isBanned = State.user && (group.banned || []).includes(State.user.id);

    /* چک دسترسی */
    if (group.type === 'private' && !isMember && !isOwner && !isAdmin && !isMod) {
        if (isBanned) {
            box.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🚫</div>
                    <h3>از این گروه بن شدی</h3>
                    <p>هیچ دسترسی به این گروه نداری</p>
                </div>
            `;
            return;
        }
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔒</div>
                <h3>گروه خصوصی</h3>
                <p>برای ورود به این گروه، باید درخواست بدی</p>
                <button class="btn-primary" id="requestJoinBtn">درخواست عضویت</button>
            </div>
        `;
        $('#requestJoinBtn')?.addEventListener('click', () => requestJoinGroup(groupId));
        return;
    }

    /* چت */
    const messages = group.messages || [];
    const visibleMessages = messages.slice(-20);

    box.innerHTML = `
        <div class="group-page-header">
            <div class="group-page-avatar">${group.avatar ? `<img src="${group.avatar}">` : (group.name || 'G')[0].toUpperCase()}</div>
            <div class="group-page-info">
                <h1>${escapeHtml(group.name)}</h1>
                <p>
                    <span>${group.type === 'public' ? '🌍 عمومی' : '🔒 خصوصی'}</span>
                    <span>${faNum((group.members || []).length)} عضو</span>
                    <span>${faNum(messages.length)} پیام</span>
                </p>
            </div>
            <div class="group-page-actions">
                ${(isOwner || isAdmin || isMod) ? `
                    <button class="btn-ghost small" id="groupSettingsBtn">⚙️</button>
                ` : ''}
                ${!isMember && group.type === 'public' && !isBanned ? `
                    <button class="btn-primary small" id="joinGroupBtn">عضویت</button>
                ` : ''}
                ${isBanned ? `
                    <span class="role-badge" style="background:rgba(220,38,38,.15);color:var(--bad);padding:6px 12px;border-radius:100px;font-size:11px;">🚫 بن شده</span>
                ` : ''}
            </div>
        </div>

        <div class="chat-box">
            <div class="chat-messages" id="chatMessages">
                ${messages.length > 20 ? `
                    <button class="chat-load-more" id="loadMoreMsgs">📜 نمایش ۲۰ پیام قدیمی‌تر</button>
                ` : ''}

                ${visibleMessages.map(m => renderChatMessage(m, group)).join('')}
            </div>

            ${(isMember || isOwner || isAdmin || isMod) ? `
                <div class="chat-input-wrap">
                    <div class="chat-editor" id="chatEditor" contenteditable="true" data-placeholder="پیامت رو بنویس..."></div>
                    <div class="chat-toolbar">
                        <div class="chat-toolbar-left">
                            <button type="button" data-cmd="bold"><b>B</b></button>
                            <button type="button" data-cmd="italic"><i>I</i></button>
                            <button type="button" id="chatSpoiler">👁️</button>
                            <button type="button" id="chatColor">🎨</button>
                            <button type="button" id="chatImage">📷</button>
                        </div>
                        <div class="chat-toolbar-right">
                            <button type="button" class="chat-send-btn" id="chatSend">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4z"/></svg>
                                <span>ارسال</span>
                            </button>
                        </div>
                    </div>
                    <div class="color-picker" id="chatColorPicker" hidden style="margin-top:8px;">
                        <div class="color-dot" style="background:#dc2626;" data-color="#dc2626"></div>
                        <div class="color-dot" style="background:#ea580c;" data-color="#ea580c"></div>
                        <div class="color-dot" style="background:#d97706;" data-color="#d97706"></div>
                        <div class="color-dot" style="background:#16a34a;" data-color="#16a34a"></div>
                        <div class="color-dot" style="background:#2563eb;" data-color="#2563eb"></div>
                        <div class="color-dot" style="background:#7c3aed;" data-color="#7c3aed"></div>
                        <div class="color-dot" style="background:#d1006b;" data-color="#d1006b"></div>
                    </div>
                </div>
            ` : `
                <div class="chat-input-wrap" style="text-align:center;">
                    <p style="font-size:12px;color:var(--tx-mute);padding:12px;">
                        ${isBanned ? '🚫 تو بن شدی، نمی‌تونی پیام بفرستی' : 'عضو نیستی، نمی‌تونی پیام بفرستی'}
                    </p>
                </div>
            `}
        </div>
    `;

    /* Event Listeners */
    initChat(groupId);

    $('#groupSettingsBtn')?.addEventListener('click', () => openGroupSettings(groupId));
    $('#joinGroupBtn')?.addEventListener('click', () => joinGroup(groupId));
    $('#loadMoreMsgs')?.addEventListener('click', () => loadMoreMessages(groupId));
}

function renderChatMessage(msg, group) {
    const user = DB.getUsers().find(u => u.id === msg.userId);
    const name = user?.displayName || msg.userName || 'ناشناس';
    const avatar = user?.avatar || msg.userAvatar;
    const initial = name[0].toUpperCase();

    let roleBadge = '';
    if (group.ownerId === msg.userId) roleBadge = '<span class="role-badge owner">مدیر</span>';
    else if ((group.admins || []).includes(msg.userId)) roleBadge = '<span class="role-badge admin">ادمین</span>';
    else if ((group.mods || []).includes(msg.userId)) roleBadge = '<span class="role-badge mod">ناظر</span>';

    const userLiked = State.user && (msg.likes || []).includes(State.user.id);
    const userDisliked = State.user && (msg.dislikes || []).includes(State.user.id);

    return `
        <div class="chat-msg" data-msg-id="${msg.id}">
            <div class="user-avatar">${avatar ? `<img src="${avatar}">` : initial}</div>
            <div class="chat-msg-content">
                <div class="chat-msg-head">
                    <strong>${escapeHtml(name)}</strong>
                    ${roleBadge}
                    <span class="time">${timeAgo(msg.createdAt)}</span>
                </div>
                <div class="chat-msg-body">${msg.content}</div>
                ${msg.image ? `<img src="${msg.image}" class="chat-msg-image" onclick="Nova.viewImage('${msg.id}','${group.id}')">` : ''}
                <div class="chat-msg-actions">
                    <button class="chat-msg-btn ${userLiked ? 'liked' : ''}" data-msg-like="${msg.id}">
                        ❤️ ${faNum((msg.likes || []).length)}
                    </button>
                    <button class="chat-msg-btn ${userDisliked ? 'disliked' : ''}" data-msg-dislike="${msg.id}">
                        👎 ${faNum((msg.dislikes || []).length)}
                    </button>
                    <button class="chat-msg-btn" data-msg-reply="${msg.id}">💬 پاسخ</button>
                    ${State.user && (State.user.id === msg.userId || group.ownerId === State.user.id || (group.admins || []).includes(State.user.id) || (group.mods || []).includes(State.user.id)) ? `
                        <button class="chat-msg-btn" data-msg-del="${msg.id}">🗑</button>
                    ` : ''}
                </div>
                ${msg.replies?.length ? `
                    <div style="margin-top:8px;padding-right:14px;border-right:2px solid var(--bd);display:flex;flex-direction:column;gap:6px;">
                        ${msg.replies.map(r => `
                            <div style="font-size:12px;">
                                <strong style="color:var(--accent);">${escapeHtml(r.userName)}:</strong>
                                <span style="color:var(--tx-dim);">${r.content}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function initChat(groupId) {
    const editor = $('#chatEditor');
    if (editor) {
        $$('.chat-toolbar button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.execCommand(btn.dataset.cmd, false, null);
                editor.focus();
            });
        });

        $('#chatSpoiler')?.addEventListener('click', () => {
            const sel = window.getSelection().toString() || 'متن مخفی';
            document.execCommand('insertHTML', false, `<span class="spoiler" onclick="this.classList.toggle('revealed')">${escapeHtml(sel)}</span>`);
            editor.focus();
        });

        $('#chatColor')?.addEventListener('click', () => {
            const p = $('#chatColorPicker');
            if (p) p.hidden = !p.hidden;
        });

        $$('#chatColorPicker .color-dot').forEach(d => {
            d.addEventListener('click', () => {
                document.execCommand('foreColor', false, d.dataset.color);
                editor.focus();
            });
        });

        $('#chatImage')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async () => {
                try {
                    const b64 = await fileToBase64(input.files[0]);
                    sendChatMessage(groupId, null, b64);
                } catch (err) { toast('❌ ' + err); }
            };
            input.click();
        });

        $('#chatSend')?.addEventListener('click', () => {
            const content = editor.innerHTML.trim();
            if (!content || editor.textContent.trim().length < 1) return;
            sendChatMessage(groupId, content);
            editor.innerHTML = '';
        });

        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                $('#chatSend')?.click();
            }
        });
    }

    /* Like/Dislike/Reply/Delete */
    const chatBox = $('#chatMessages');
    chatBox?.addEventListener('click', (e) => {
        const like = e.target.closest('[data-msg-like]');
        const dislike = e.target.closest('[data-msg-dislike]');
        const reply = e.target.closest('[data-msg-reply]');
        const del = e.target.closest('[data-msg-del]');

        if (like) toggleMsgReaction(groupId, like.dataset.msgLike, 'like');
        if (dislike) toggleMsgReaction(groupId, dislike.dataset.msgDislike, 'dislike');
        if (reply) replyToMessage(groupId, reply.dataset.msgReply);
        if (del) {
            if (confirm('حذف بشه؟')) {
                deleteMessage(groupId, del.dataset.msgDel);
            }
        }
    });
}

function sendChatMessage(groupId, content, image = null) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    g.messages = g.messages || [];
    g.messages.push({
        id: uid('m_'),
        userId: State.user.id,
        userName: State.user.displayName,
        userAvatar: State.user.avatar,
        content: content ? parseMentions(content) : '',
        image: image,
        createdAt: Date.now(),
        likes: [],
        dislikes: [],
        replies: []
    });

    DB.setGroups(groups);

    /* Activity */
    addActivity('chat', `${State.user.displayName} توی گروه «${g.name}» پیام داد`);

    renderGroupPage(groupId);

    /* اسکرول به آخر */
    setTimeout(() => {
        const box = $('#chatMessages');
        if (box) box.scrollTop = box.scrollHeight;
    }, 100);
}

function toggleMsgReaction(groupId, msgId, type) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    const msg = (g.messages || []).find(m => m.id === msgId);
    if (!msg) return;

    msg.likes = msg.likes || [];
    msg.dislikes = msg.dislikes || [];

    if (type === 'like') {
        msg.dislikes = msg.dislikes.filter(id => id !== State.user.id);
        if (msg.likes.includes(State.user.id)) {
            msg.likes = msg.likes.filter(id => id !== State.user.id);
        } else {
            msg.likes.push(State.user.id);
        }
    } else {
        msg.likes = msg.likes.filter(id => id !== State.user.id);
        if (msg.dislikes.includes(State.user.id)) {
            msg.dislikes = msg.dislikes.filter(id => id !== State.user.id);
        } else {
            msg.dislikes.push(State.user.id);
        }
    }

    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function replyToMessage(groupId, msgId) {
    const text = prompt('پاسخ:');
    if (!text) return;
    if (!State.user) return;

    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    const msg = (g.messages || []).find(m => m.id === msgId);
    if (!msg) return;

    msg.replies = msg.replies || [];
    msg.replies.push({
        userId: State.user.id,
        userName: State.user.displayName,
        content: escapeHtml(text),
        createdAt: Date.now()
    });

    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function deleteMessage(groupId, msgId) {
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    g.messages = (g.messages || []).filter(m => m.id !== msgId);
    DB.setGroups(groups);
    renderGroupPage(groupId);
    toast('🗑 حذف شد');
}

function joinGroup(groupId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    if ((g.banned || []).includes(State.user.id)) {
        toast('❌ تو از این گروه بن شدی');
        return;
    }

    g.members = g.members || [];
    if (!g.members.includes(State.user.id)) {
        g.members.push(State.user.id);
    }

    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    me.groups = me.groups || [];
    if (!me.groups.includes(groupId)) me.groups.push(groupId);

    DB.setUsers(users);
    DB.setGroups(groups);
    State.user = me;

    toast('✅ عضو شدی');
    renderGroupPage(groupId);
}

function requestJoinGroup(groupId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    g.joinRequests = g.joinRequests || [];
    if (!g.joinRequests.includes(State.user.id)) {
        g.joinRequests.push(State.user.id);
    }

    DB.setGroups(groups);

    /* اعلان به مدیر گروه */
    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'),
        userId: g.ownerId,
        type: 'group_request',
        text: `${State.user.displayName} درخواست عضویت در گروه «${g.name}» داد`,
        link: `group:${g.id}`,
        ts: Date.now(),
        read: false
    });
    DB.setNotifs(notifs);

    toast('✅ درخواست ارسال شد');
}

function openGroupSettings(groupId) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    const isOwner = g.ownerId === State.user.id;
    const isAdmin = (g.admins || []).includes(State.user.id);
    const isMod = (g.mods || []).includes(State.user.id);

    if (!isOwner && !isAdmin && !isMod) {
        toast('❌ دسترسی نداری');
        return;
    }

    const box = $('#groupSettingsBody');
    if (!box) return;

    const members = (g.members || []).map(mid => {
        const u = DB.getUsers().find(x => x.id === mid);
        if (!u) return '';
        const isOwnerM = g.ownerId === mid;
        const isAdminM = (g.admins || []).includes(mid);
        const isModM = (g.mods || []).includes(mid);

        let roleLabel = '';
        if (isOwnerM) roleLabel = '<span class="role-badge owner">مدیر</span>';
        else if (isAdminM) roleLabel = '<span class="role-badge admin">ادمین</span>';
        else if (isModM) roleLabel = '<span class="role-badge mod">ناظر</span>';

        return `
            <div class="panel-row">
                <div class="panel-stat">
                    <div class="user-avatar" style="width:32px;height:32px;">${u.avatar ? `<img src="${u.avatar}">` : u.displayName[0]}</div>
                    <div>
                        <strong>${escapeHtml(u.displayName)}</strong> ${roleLabel}
                        <div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@${u.username}</div>
                    </div>
                </div>
                ${!isOwnerM && (isOwner || isAdmin) ? `
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                        ${isOwner ? `<button class="btn-ghost small" data-promote-admin="${mid}">+ ادمین</button>` : ''}
                        ${isOwner || isAdmin ? `<button class="btn-ghost small" data-promote-mod="${mid}">+ ناظر</button>` : ''}
                        <button class="btn-ghost small" data-ban-member="${mid}" style="color:var(--bad);">بن</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    box.innerHTML = `
        <div class="form-group" style="margin-bottom:14px;">
            <label>اسم گروه</label>
            <input type="text" id="gName" value="${escapeHtml(g.name)}">
        </div>

        <div class="form-group" style="margin-bottom:14px;">
            <label>توضیحات</label>
            <textarea id="gDesc">${escapeHtml(g.description || '')}</textarea>
        </div>

        <button class="btn-primary full" id="gSave" style="margin-bottom:20px;">ذخیره تغییرات</button>

        <h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">اعضای گروه (${faNum((g.members || []).length)})</h4>
        <div style="max-height:300px;overflow-y:auto;margin-bottom:16px;">
            ${members}
        </div>

        ${(g.joinRequests || []).length ? `
            <h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">درخواست‌های عضویت</h4>
            ${g.joinRequests.map(mid => {
                const u = DB.getUsers().find(x => x.id === mid);
                if (!u) return '';
                return `
                    <div class="panel-row">
                        <strong>${escapeHtml(u.displayName)}</strong>
                        <div style="display:flex;gap:4px;">
                            <button class="btn-primary small" data-accept-join="${mid}">قبول</button>
                            <button class="btn-ghost small" data-reject-join="${mid}">رد</button>
                        </div>
                    </div>
                `;
            }).join('')}
        ` : ''}
    `;

    openModal('groupSettingsOverlay');

    $('#gSave')?.addEventListener('click', () => {
        const newName = $('#gName').value.trim();
        const newDesc = $('#gDesc').value.trim();
        if (!newName) return;

        const groups2 = DB.getGroups();
        const gg = groups2.find(x => x.id === groupId);
        if (!gg) return;

        const oldName = gg.name;
        gg.name = newName;
        gg.description = newDesc;
        DB.setGroups(groups2);

        /* اعلان توی گروه */
        if (oldName !== newName) {
            gg.messages = gg.messages || [];
            gg.messages.push({
                id: uid('m_'),
                userId: 'system',
                userName: 'سیستم',
                content: `📢 اسم گروه از «${escapeHtml(oldName)}» به «${escapeHtml(newName)}» تغییر کرد`,
                createdAt: Date.now(),
                likes: [], dislikes: [], replies: []
            });
            DB.setGroups(groups2);
        }

        toast('✅ ذخیره شد');
        closeModal('groupSettingsOverlay');
        renderGroupPage(groupId);
    });

    /* Promote/Ban */
    box.addEventListener('click', (e) => {
        const pa = e.target.closest('[data-promote-admin]');
        const pm = e.target.closest('[data-promote-mod]');
        const ban = e.target.closest('[data-ban-member]');
        const acc = e.target.closest('[data-accept-join]');
        const rej = e.target.closest('[data-reject-join]');

        if (pa) {
            const groups2 = DB.getGroups();
            const gg = groups2.find(x => x.id === groupId);
            gg.admins = gg.admins || [];
            if (!gg.admins.includes(pa.dataset.promoteAdmin)) gg.admins.push(pa.dataset.promoteAdmin);
            DB.setGroups(groups2);
            toast('✅ ادمین شد');
            openGroupSettings(groupId);
        }

        if (pm) {
            const groups2 = DB.getGroups();
            const gg = groups2.find(x => x.id === groupId);
            gg.mods = gg.mods || [];
            if (!gg.mods.includes(pm.dataset.promoteMod)) gg.mods.push(pm.dataset.promoteMod);
            DB.setGroups(groups2);
            toast('✅ ناظر شد');
            openGroupSettings(groupId);
        }

        if (ban) {
            if (!confirm('بن بشه؟')) return;
            const groups2 = DB.getGroups();
            const gg = groups2.find(x => x.id === groupId);
            gg.banned = gg.banned || [];
            if (!gg.banned.includes(ban.dataset.banMember)) gg.banned.push(ban.dataset.banMember);
            gg.members = (gg.members || []).filter(id => id !== ban.dataset.banMember);

            /* پیام سیستمی */
            gg.messages = gg.messages || [];
            const banned = DB.getUsers().find(u => u.id === ban.dataset.banMember);
            gg.messages.push({
                id: uid('m_'),
                userId: 'system',
                userName: 'سیستم',
                content: `🚫 «${escapeHtml(banned?.displayName || 'کاربر')}» توسط «${escapeHtml(State.user.displayName)}» بن شد`,
                createdAt: Date.now(),
                likes: [], dislikes: [], replies: []
            });

            DB.setGroups(groups2);
            toast('✅ بن شد');
            openGroupSettings(groupId);
        }

        if (acc) {
            const groups2 = DB.getGroups();
            const gg = groups2.find(x => x.id === groupId);
            gg.joinRequests = (gg.joinRequests || []).filter(id => id !== acc.dataset.acceptJoin);
            gg.members = gg.members || [];
            if (!gg.members.includes(acc.dataset.acceptJoin)) gg.members.push(acc.dataset.acceptJoin);
            DB.setGroups(groups2);
            toast('✅ قبول شد');
            openGroupSettings(groupId);
        }

        if (rej) {
            const groups2 = DB.getGroups();
            const gg = groups2.find(x => x.id === groupId);
            gg.joinRequests = (gg.joinRequests || []).filter(id => id !== rej.dataset.rejectJoin);
            DB.setGroups(groups2);
            toast('رد شد');
            openGroupSettings(groupId);
        }
    });
}

/* ═══════════════════════════════════
   ۱۴. صفحه کاربران
═══════════════════════════════════ */
function renderUsersPage() {
    const grid = $('#usersGrid');
    if (!grid) return;

    const users = DB.getUsers();

    grid.innerHTML = users.map(u => `
        <div class="post-card" style="cursor:default;">
            <div class="post-card-cover" style="height:80px;${u.cover ? `background:url('${u.cover}') center/cover;` : ''}"></div>
            <div class="post-card-body" style="text-align:center;padding-top:0;">
                <div class="user-avatar" style="width:64px;height:64px;font-size:24px;margin:-32px auto 10px;border:3px solid var(--bg-2);">
                    ${u.avatar ? `<img src="${u.avatar}">` : u.displayName[0].toUpperCase()}
                </div>
                <h3 style="font-size:15px;font-weight:800;margin-bottom:2px;">${escapeHtml(u.displayName)}</h3>
                <p style="font-size:12px;color:var(--tx-mute);direction:ltr;margin-bottom:12px;">@${escapeHtml(u.username)}</p>
                ${State.user && State.user.id !== u.id ? `
                    <button class="btn-primary small full" data-add-friend="${u.id}">+ دوستی</button>
                ` : ''}
            </div>
        </div>
    `).join('');

    grid.addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-add-friend]');
        if (addBtn) sendFriendRequest(addBtn.dataset.addFriend);
    });
}

/* ═══════════════════════════════════
   ۱۵. صفحه فعالیت‌ها
═══════════════════════════════════ */
function renderActivityPage() {
    const list = $('#activityList');
    if (!list) return;

    const activities = DB.getActivity().slice(-50).reverse();

    if (!activities.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>هنوز فعالیتی نیست</h3>
                <p>وقتی کاربرا فعالیت کنن، اینجا نمایش داده می‌شه</p>
            </div>
        `;
        return;
    }

    list.innerHTML = activities.map(a => `
        <div class="notif-item">
            <div class="notif-icon">${a.icon || '📢'}</div>
            <div class="notif-body">
                <p>${escapeHtml(a.text)}</p>
                <small>${timeAgo(a.ts)}</small>
            </div>
        </div>
    `).join('');
}

function addActivity(type, text) {
    const activities = DB.getActivity();
    const icons = { post: '📝', comment: '💬', chat: '💭', like: '❤️', friend: '👥', group: '📁' };
    activities.push({ id: uid('a_'), type, text, icon: icons[type] || '📢', ts: Date.now() });
    if (activities.length > 200) activities.splice(0, activities.length - 200);
    DB.setActivity(activities);
}

/* ═══════════════════════════════════
   ۱۶. دوستان
═══════════════════════════════════ */
function sendFriendRequest(targetId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    if (targetId === State.user.id) return;

    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    const target = users.find(u => u.id === targetId);
    if (!me || !target) return;

    if ((me.friends || []).includes(targetId)) { toast('قبلا دوستته'); return; }
    if ((target.friendRequests || []).includes(me.id)) { toast('قبلا درخواست دادی'); return; }

    target.friendRequests = target.friendRequests || [];
    target.friendRequests.push(me.id);
    DB.setUsers(users);
    State.user = me;

    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'),
        userId: targetId,
        type: 'friend_request',
        text: `${me.displayName} بهت درخواست دوستی داد`,
        from: me.id,
        ts: Date.now(),
        read: false
    });
    DB.setNotifs(notifs);

    addActivity('friend', `${me.displayName} به ${target.displayName} درخواست دوستی داد`);
    toast('✅ درخواست فرستاده شد');
}

/* ═══════════════════════════════════
   ۱۷. پنل کاربری
═══════════════════════════════════ */
function openPanel() {
    if (!State.user) { openModal('authOverlay'); return; }
    const panel = $('#userPanel');
    if (!panel) return;

    renderUserPanelBody('activity');
    panel.classList.add('on');
    document.body.style.overflow = 'hidden';
}

function closePanel() {
    const panel = $('#userPanel');
    if (panel) panel.classList.remove('on');
    document.body.style.overflow = '';
}

function renderUserPanelBody(tab) {
    const body = $('#userPanelBody');
    if (!body || !State.user) return;

    switch (tab) {
        case 'activity':      body.innerHTML = renderActivityTab(); break;
        case 'profile':       body.innerHTML = renderProfileTab(); break;
        case 'notifications': body.innerHTML = renderNotifsTab(); break;
        case 'messages':      body.innerHTML = renderMessagesTab(); break;
        case 'friends':       body.innerHTML = renderFriendsTab(); break;
        case 'groups':        body.innerHTML = renderGroupsTab(); break;
    }

    /* Event Listeners */
    initUserPanelEvents(tab);
}

function renderActivityTab() {
    const u = State.user;
    const posts = DB.getPosts().filter(p => p.authorId === u.id);
    const comments = DB.getPosts().reduce((sum, p) => sum + (p.comments || []).filter(c => c.userId === u.id).length, 0);

    return `
        <div class="up-content active">
            <div class="panel-stats-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                <div class="panel-stat-box"><strong>${faNum(u.xp || 0)}</strong><span>XP</span></div>
                <div class="panel-stat-box"><strong>${faNum(u.level || 1)}</strong><span>سطح</span></div>
                <div class="panel-stat-box"><strong>${faNum(posts.length)}</strong><span>پست</span></div>
                <div class="panel-stat-box"><strong>${faNum(comments)}</strong><span>نظر</span></div>
                <div class="panel-stat-box"><strong>${faNum((u.friends || []).length)}</strong><span>دوست</span></div>
                <div class="panel-stat-box"><strong>${faNum((u.groups || []).length)}</strong><span>گروه</span></div>
            </div>

            <div style="padding:14px;border-radius:14px;background:var(--field);border:1px solid var(--bd);">
                <div style="font-size:12px;color:var(--tx-mute);margin-bottom:6px;">وضعیت حساب</div>
                <div style="font-size:14px;font-weight:700;">
                    ${u.role === 'admin' ? '👑 مدیر سایت' : u.role === 'editor' ? '⭐ سردبیر' : u.role === 'author' ? '✍️ نویسنده' : '👤 کاربر'}
                </div>
            </div>
        </div>
    `;
}

function renderProfileTab() {
    const u = State.user;
    return `
        <div class="up-content active">
            <div class="profile-form">
                <div class="profile-avatar-section">
                    <div class="user-avatar" id="profileAvatarEdit">
                        ${u.avatar ? `<img src="${u.avatar}">` : u.displayName[0].toUpperCase()}
                    </div>
                    <button class="btn-ghost small" id="changeAvatarBtn">تغییر آواتار</button>
                    <input type="file" id="avatarFile" accept="image/*" hidden>
                </div>

                <div class="form-group">
                    <label>لقب</label>
                    <input type="text" id="pTitle" value="${escapeHtml(u.title || '')}" placeholder="مثلاً: گیمر حرفه‌ای">
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>نام</label>
                        <input type="text" id="pFirstName" value="${escapeHtml(u.firstName || '')}">
                    </div>
                    <div class="form-group">
                        <label>نام خانوادگی</label>
                        <input type="text" id="pLastName" value="${escapeHtml(u.lastName || '')}">
                    </div>
                </div>

                <div class="form-group">
                    <label>نام نمایشی</label>
                    <input type="text" id="pDisplayName" value="${escapeHtml(u.displayName)}">
                </div>

                <div class="form-group">
                    <label>تاریخ تولد</label>
                    <input type="text" id="pBirthday" value="${escapeHtml(u.birthday || '')}" placeholder="مثلاً 1380/01/15">
                </div>

                <div class="form-group">
                    <label>پلتفرم</label>
                    <select id="pPlatform">
                        <option value="ps5" ${u.platform === 'ps5' ? 'selected' : ''}>PlayStation 5</option>
                        <option value="xbox" ${u.platform === 'xbox' ? 'selected' : ''}>Xbox</option>
                        <option value="switch" ${u.platform === 'switch' ? 'selected' : ''}>Nintendo Switch</option>
                        <option value="pc" ${u.platform === 'pc' ? 'selected' : ''}>PC</option>
                        <option value="mobile" ${u.platform === 'mobile' ? 'selected' : ''}>Mobile</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>وبسایت</label>
                    <input type="text" id="pWebsite" value="${escapeHtml(u.website || '')}" placeholder="https://..." dir="ltr">
                </div>

                <div class="form-group">
                    <label>بیوگرافی</label>
                    <textarea id="pBio" placeholder="درباره خودت بنویس...">${escapeHtml(u.bio || '')}</textarea>
                </div>

                <div class="form-group">
                    <label>بازی‌های مورد علاقه</label>
                    <input type="text" id="pFavGames" value="${escapeHtml(u.favGames || '')}" placeholder="Elden Ring, Witcher 3, ...">
                </div>

                <div class="form-group">
                    <label>فیلم‌های مورد علاقه</label>
                    <input type="text" id="pFavMovies" value="${escapeHtml(u.favMovies || '')}" placeholder="Interstellar, ...">
                </div>

                <div class="form-group">
                    <label>اینستاگرام</label>
                    <input type="text" id="pInstagram" value="${escapeHtml(u.instagram || '')}" placeholder="@username" dir="ltr">
                </div>

                <div class="form-group">
                    <label>تلگرام</label>
                    <input type="text" id="pTelegram" value="${escapeHtml(u.telegram || '')}" placeholder="@username" dir="ltr">
                </div>

                <div class="form-group">
                    <label>دیسکورد</label>
                    <input type="text" id="pDiscord" value="${escapeHtml(u.discord || '')}" placeholder="username#1234" dir="ltr">
                </div>

                <button class="btn-primary full" id="saveProfileBtn" style="margin-top:10px;">ذخیره پروفایل</button>

                <button class="btn-ghost full" id="logoutBtn" style="margin-top:8px;color:var(--bad);border-color:var(--bad);">
                    خروج از حساب
                </button>
            </div>
        </div>
    `;
}

function renderNotifsTab() {
    const notifs = DB.getNotifs().filter(n => n.userId === State.user.id).reverse();
    const unread = notifs.filter(n => !n.read);

    if (!notifs.length) {
        return `<div class="empty-state"><div class="empty-icon">🔔</div><h3>اعلانی نداری</h3></div>`;
    }

    return `
        <div class="up-content active">
            ${unread.length ? `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-size:12px;font-weight:700;color:var(--tx-mute);">${faNum(unread.length)} خوانده‌نشده</span>
                    <button class="btn-ghost small" id="markAllRead">خواندن همه</button>
                </div>
            ` : ''}
            ${notifs.map(n => `
                <div class="notif-item ${!n.read ? 'unread' : ''}" data-notif-id="${n.id}" ${n.link ? `data-notif-link="${n.link}"` : ''}>
                    <div class="notif-icon">${getNotifIcon(n.type)}</div>
                    <div class="notif-body">
                        <p>${escapeHtml(n.text)}</p>
                        <small>${timeAgo(n.ts)}</small>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getNotifIcon(type) {
    return { comment: '💬', friend_request: '👥', message: '✉️', group_request: '📁', like: '❤️' }[type] || '🔔';
}

function renderMessagesTab() {
    const msgs = DB.getMessages().filter(m => m.to === State.user.id || m.from === State.user.id).reverse();

    if (!msgs.length) {
        return `<div class="empty-state"><div class="empty-icon">💬</div><h3>پیامی نداری</h3></div>`;
    }

    return `
        <div class="up-content active">
            ${msgs.map(m => {
                const isMine = m.from === State.user.id;
                const otherId = isMine ? m.to : m.from;
                const other = DB.getUsers().find(u => u.id === otherId);
                return `
                    <div class="notif-item">
                        <div class="user-avatar" style="width:36px;height:36px;">
                            ${other?.avatar ? `<img src="${other.avatar}">` : (other?.displayName || 'U')[0]}
                        </div>
                        <div class="notif-body">
                            <p><strong>${isMine ? 'شما →' : `${escapeHtml(other?.displayName || 'کاربر')} →`}</strong> ${escapeHtml(m.text)}</p>
                            <small>${timeAgo(m.ts)}</small>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderFriendsTab() {
    const u = State.user;
    const friends = u.friends || [];
    const requests = u.friendRequests || [];

    return `
        <div class="up-content active">
            ${requests.length ? `
                <h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">درخواست‌ها (${faNum(requests.length)})</h4>
                ${requests.map(rid => {
                    const r = DB.getUsers().find(x => x.id === rid);
                    if (!r) return '';
                    return `
                        <div class="notif-item">
                            <div class="user-avatar" style="width:36px;height:36px;">${r.avatar ? `<img src="${r.avatar}">` : r.displayName[0]}</div>
                            <div class="notif-body">
                                <p><strong>${escapeHtml(r.displayName)}</strong> @${escapeHtml(r.username)}</p>
                                <div style="display:flex;gap:6px;margin-top:6px;">
                                    <button class="btn-primary small" data-accept-friend="${rid}">قبول</button>
                                    <button class="btn-ghost small" data-reject-friend="${rid}">رد</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            ` : ''}

            <h4 style="font-size:14px;font-weight:800;margin:16px 0 10px;">دوستان (${faNum(friends.length)})</h4>
            ${!friends.length ? '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">هنوز دوستی نداری</p>' :
                friends.map(fid => {
                    const f = DB.getUsers().find(x => x.id === fid);
                    if (!f) return '';
                    return `
                        <div class="notif-item">
                            <div class="user-avatar" style="width:36px;height:36px;">${f.avatar ? `<img src="${f.avatar}">` : f.displayName[0]}</div>
                            <div class="notif-body">
                                <p><strong>${escapeHtml(f.displayName)}</strong></p>
                                <small>@${escapeHtml(f.username)}</small>
                            </div>
                            <button class="btn-ghost small" data-chat-friend="${fid}">پیام</button>
                        </div>
                    `;
                }).join('')
            }
        </div>
    `;
}

function renderGroupsTab() {
    const u = State.user;
    const groups = DB.getGroups().filter(g => (u.groups || []).includes(g.id));

    if (!groups.length) {
        return `<div class="empty-state"><div class="empty-icon">📁</div><h3>توی هیچ گروهی نیستی</h3></div>`;
    }

    return `
        <div class="up-content active">
            ${groups.map(g => `
                <div class="notif-item" data-group-link="${g.id}">
                    <div class="user-avatar" style="width:36px;height:36px;">${g.avatar ? `<img src="${g.avatar}">` : g.name[0]}</div>
                    <div class="notif-body">
                        <p><strong>${escapeHtml(g.name)}</strong></p>
                        <small>${faNum((g.members || []).length)} عضو</small>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function initUserPanelEvents(tab) {
    if (tab === 'profile') {
        $('#changeAvatarBtn')?.addEventListener('click', () => $('#avatarFile')?.click());
        $('#avatarFile')?.addEventListener('change', async (e) => {
            try {
                const b64 = await fileToBase64(e.target.files[0]);
                const users = DB.getUsers();
                const me = users.find(u => u.id === State.user.id);
                me.avatar = b64;
                DB.setUsers(users);
                State.user = me;
                updateAuthUI();
                renderUserPanelBody('profile');
                toast('✅ آواتار تغییر کرد');
            } catch (err) { toast('❌ ' + err); }
        });

        $('#saveProfileBtn')?.addEventListener('click', () => {
            const users = DB.getUsers();
            const me = users.find(u => u.id === State.user.id);
            me.title = $('#pTitle').value.trim();
            me.firstName = $('#pFirstName').value.trim();
            me.lastName = $('#pLastName').value.trim();
            me.displayName = $('#pDisplayName').value.trim() || me.displayName;
            me.birthday = $('#pBirthday').value.trim();
            me.platform = $('#pPlatform').value;
            me.website = $('#pWebsite').value.trim();
            me.bio = $('#pBio').value.trim();
            me.favGames = $('#pFavGames').value.trim();
            me.favMovies = $('#pFavMovies').value.trim();
            me.instagram = $('#pInstagram').value.trim();
            me.telegram = $('#pTelegram').value.trim();
            me.discord = $('#pDiscord').value.trim();
            DB.setUsers(users);
            State.user = me;
            updateAuthUI();
            toast('✅ ذخیره شد');
        });

        $('#logoutBtn')?.addEventListener('click', logoutUser);
    }

    if (tab === 'notifications') {
        $('#markAllRead')?.addEventListener('click', () => {
            const notifs = DB.getNotifs();
            notifs.forEach(n => { if (n.userId === State.user.id) n.read = true; });
            DB.setNotifs(notifs);
            updateBadges();
            renderUserPanelBody('notifications');
        });

        $$('[data-notif-id]').forEach(el => {
            el.addEventListener('click', () => {
                const nid = el.dataset.notifId;
                const notifs = DB.getNotifs();
                const n = notifs.find(x => x.id === nid);
                if (n) {
                    n.read = true;
                    DB.setNotifs(notifs);
                    updateBadges();
                }

                const link = el.dataset.notifLink;
                if (link) {
                    const [type, id] = link.split(':');
                    if (type === 'post') showPage('post', id);
                    if (type === 'group') showPage('group', id);
                    closePanel();
                } else {
                    renderUserPanelBody('notifications');
                }
            });
        });
    }

    if (tab === 'friends') {
        $$('[data-accept-friend]').forEach(b => b.addEventListener('click', () => {
            acceptFriend(b.dataset.acceptFriend);
        }));
        $$('[data-reject-friend]').forEach(b => b.addEventListener('click', () => {
            rejectFriend(b.dataset.rejectFriend);
        }));
        $$('[data-chat-friend]').forEach(b => b.addEventListener('click', () => {
            const text = prompt('پیام:');
            if (text) sendMessage(b.dataset.chatFriend, text);
        }));
    }

    if (tab === 'groups') {
        $$('[data-group-link]').forEach(el => el.addEventListener('click', () => {
            closePanel();
            showPage('group', el.dataset.groupLink);
        }));
    }
}

function acceptFriend(fromId) {
    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    const other = users.find(u => u.id === fromId);
    if (!me || !other) return;

    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    me.friends = me.friends || [];
    other.friends = other.friends || [];
    if (!me.friends.includes(fromId)) me.friends.push(fromId);
    if (!other.friends.includes(me.id)) other.friends.push(me.id);

    DB.setUsers(users);
    State.user = me;
    updateBadges();
    renderUserPanelBody('friends');
    toast('✅ حالا دوستید');
}

function rejectFriend(fromId) {
    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    DB.setUsers(users);
    State.user = me;
    updateBadges();
    renderUserPanelBody('friends');
}

function sendMessage(toId, text) {
    const messages = DB.getMessages();
    messages.push({
        id: uid('m_'),
        from: State.user.id,
        to: toId,
        text,
        ts: Date.now(),
        read: false
    });
    DB.setMessages(messages);

    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'),
        userId: toId,
        type: 'message',
        text: `${State.user.displayName} بهت پیام داد`,
        ts: Date.now(),
        read: false
    });
    DB.setNotifs(notifs);

    toast('✅ پیام فرستاده شد');
}

/* ═══════════════════════════════════
   ۱۸. اعلان‌ها و پیام‌ها (Panel)
═══════════════════════════════════ */
function toggleNotifPanel() {
    const p = $('#notifPanel');
    const c = $('#chatPanel');
    if (c) c.hidden = true;
    if (!p) return;

    if (p.hidden) {
        p.hidden = false;
        renderNotifPanel();
    } else {
        p.hidden = true;
    }
}

function renderNotifPanel() {
    const body = $('#notifPanelBody');
    if (!body || !State.user) return;

    const notifs = DB.getNotifs().filter(n => n.userId === State.user.id).reverse().slice(0, 20);

    if (!notifs.length) {
        body.innerHTML = '<p style="text-align:center;padding:30px;font-size:13px;color:var(--tx-mute);">اعلانی نداری</p>';
        return;
    }

    body.innerHTML = notifs.map(n => `
        <div class="notif-item ${!n.read ? 'unread' : ''}" data-notif-id="${n.id}">
            <div class="notif-icon">${getNotifIcon(n.type)}</div>
            <div class="notif-body">
                <p>${escapeHtml(n.text)}</p>
                <small>${timeAgo(n.ts)}</small>
            </div>
        </div>
    `).join('');

    $$('[data-notif-id]', body).forEach(el => el.addEventListener('click', () => {
        const notifs = DB.getNotifs();
        const n = notifs.find(x => x.id === el.dataset.notifId);
        if (n) { n.read = true; DB.setNotifs(notifs); }
        updateBadges();
        renderNotifPanel();
    }));
}

function toggleChatPanel() {
    const p = $('#chatPanel');
    const n = $('#notifPanel');
    if (n) n.hidden = true;
    if (!p) return;

    if (p.hidden) {
        p.hidden = false;
        renderChatPanel();
    } else {
        p.hidden = true;
    }
}

function renderChatPanel() {
    const body = $('#chatPanelBody');
    if (!body || !State.user) return;

    const msgs = DB.getMessages().filter(m => m.to === State.user.id || m.from === State.user.id).reverse().slice(0, 20);

    if (!msgs.length) {
        body.innerHTML = '<p style="text-align:center;padding:30px;font-size:13px;color:var(--tx-mute);">پیامی نداری</p>';
        return;
    }

    body.innerHTML = msgs.map(m => {
        const isMine = m.from === State.user.id;
        const otherId = isMine ? m.to : m.from;
        const other = DB.getUsers().find(u => u.id === otherId);
        return `
            <div class="notif-item">
                <div class="user-avatar" style="width:36px;height:36px;">
                    ${other?.avatar ? `<img src="${other.avatar}">` : (other?.displayName || 'U')[0]}
                </div>
                <div class="notif-body">
                    <p><strong>${isMine ? 'شما →' : `${escapeHtml(other?.displayName || 'کاربر')} →`}</strong> ${escapeHtml(m.text)}</p>
                    <small>${timeAgo(m.ts)}</small>
                </div>
            </div>
        `;
    }).join('');

    /* علامت خوانده شدن */
    const all = DB.getMessages();
    all.forEach(m => { if (m.to === State.user.id) m.read = true; });
    DB.setMessages(all);
    updateBadges();
}

/* ═══════════════════════════════════
   ۱۹. ادیتور پست
═══════════════════════════════════ */
let editingPostId = null;

function openEditor(postId = null) {
    const u = State.user;
    if (!u) { openModal('authOverlay'); return; }
    if (u.role !== 'admin' && u.role !== 'editor' && u.role !== 'author') {
        toast('❌ اجازه نداری');
        return;
    }

    editingPostId = postId;
    const modal = $('#editorFullscreen');
    const titleEl = $('#editorTitle');
    const contentEl = $('#editorContent');
    const titleText = $('#editorTitleText');

    if (postId) {
        const post = DB.getPosts().find(p => p.id === postId);
        if (post) {
            titleEl.value = post.title;
            contentEl.innerHTML = post.content;
            $('#editorCategory').value = post.category;
            $('#editorPlatform').value = post.platform || 'all';
            $('#editorTags').value = (post.tags || []).join(', ');
            $('#editorCover').value = post.cover || '';
            $('#editorExcerpt').value = post.excerpt || '';
            $('#editorScore').value = post.score || '';
            $('#editorEditorChoice').value = post.editorChoice ? 'true' : 'false';
            $('#editorStatus').value = post.status || 'published';
            titleText.textContent = 'ویرایش پست';
        }
    } else {
        titleEl.value = '';
        contentEl.innerHTML = '';
        $('#editorCategory').value = 'news';
        $('#editorPlatform').value = 'all';
        $('#editorTags').value = '';
        $('#editorCover').value = '';
        $('#editorExcerpt').value = '';
        $('#editorScore').value = '';
        $('#editorEditorChoice').value = 'false';
        $('#editorStatus').value = 'published';
        titleText.textContent = 'پست جدید';
    }

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('on'));
    document.body.style.overflow = 'hidden';
}

function closeEditor() {
    const modal = $('#editorFullscreen');
    if (modal) {
        modal.classList.remove('on');
        setTimeout(() => { modal.hidden = true; }, 300);
    }
    document.body.style.overflow = '';
}

function saveEditor() {
    const title = $('#editorTitle').value.trim();
    const content = $('#editorContent').innerHTML;
    const category = $('#editorCategory').value;
    const platform = $('#editorPlatform').value;
    const tags = $('#editorTags').value.split(',').map(t => t.trim()).filter(Boolean);
    const cover = $('#editorCover').value.trim();
    const excerpt = $('#editorExcerpt').value.trim();
    const score = $('#editorScore').value ? +$('#editorScore').value : null;
    const editorChoice = $('#editorEditorChoice').value === 'true';
    const status = $('#editorStatus').value;

    if (!title) { toast('❌ عنوان لازمه'); return; }
    if (!content || content === '<br>') { toast('❌ محتوا لازمه'); return; }

    const u = State.user;
    const posts = DB.getPosts();

    const data = {
        id: editingPostId || uid('p_'),
        title, content, category, platform, tags, cover, excerpt, score,
        editorChoice, status,
        authorId: u.id,
        authorName: u.displayName,
        authorAvatar: u.avatar,
        createdAt: editingPostId ? (posts.find(p => p.id === editingPostId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
        views: editingPostId ? (posts.find(p => p.id === editingPostId)?.views || 0) : 0,
        likes: editingPostId ? (posts.find(p => p.id === editingPostId)?.likes || 0) : 0,
        comments: editingPostId ? (posts.find(p => p.id === editingPostId)?.comments || []) : []
    };

    const idx = posts.findIndex(p => p.id === data.id);
    if (idx > -1) posts[idx] = data;
    else posts.unshift(data);

    DB.setPosts(posts);

    if (!editingPostId) {
        addActivity('post', `${u.displayName} پست «${title}» رو منتشر کرد`);
        /* XP */
        const users = DB.getUsers();
        const me = users.find(x => x.id === u.id);
        me.xp = (me.xp || 0) + 15;
        me.level = Math.floor(me.xp / 100) + 1;
        DB.setUsers(users);
        State.user = me;
    }

    toast(editingPostId ? '✅ ویرایش شد' : '✅ منتشر شد');
    closeEditor();
    renderHome();
    editingPostId = null;
}

function initEditor() {
    /* Toolbar */
    $$('.editor-toolbar button[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
            $('#editorContent')?.focus();
        });
    });

    $('#toolbarImage')?.addEventListener('click', () => {
        const url = prompt('آدرس تصویر:');
        if (url) document.execCommand('insertImage', false, url);
    });

    $('#toolbarLink')?.addEventListener('click', () => {
        const url = prompt('آدرس لینک:');
        if (url) document.execCommand('createLink', false, url);
    });

    $('#toolbarCode')?.addEventListener('click', () => {
        const t = prompt('کد:');
        if (t) document.execCommand('insertHTML', false, `<code>${escapeHtml(t)}</code>`);
    });

    $('#toolbarSpoiler')?.addEventListener('click', () => {
        const sel = window.getSelection().toString() || 'متن مخفی';
        document.execCommand('insertHTML', false, `<span class="spoiler" onclick="this.classList.toggle('revealed')">${escapeHtml(sel)}</span>`);
    });

    $('#editorSaveBtn')?.addEventListener('click', saveEditor);
    $('#editorCloseBtn')?.addEventListener('click', closeEditor);

    $('#editorPreviewBtn')?.addEventListener('click', () => {
        const t = $('#editorTitle').value;
        const c = $('#editorContent').innerHTML;
        if (!t) { toast('عنوان خالی'); return; }
        toast('پیش‌نمایش: ' + t);
    });

    $('#editorUploadCover')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            try {
                const b64 = await fileToBase64(input.files[0]);
                $('#editorCover').value = b64;
                toast('✅ آپلود شد');
            } catch (err) { toast('❌ ' + err); }
        };
        input.click();
    });
}

/* ═══════════════════════════════════
   ۲۰. مودال‌ها
═══════════════════════════════════ */
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('on'));
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('on');
    setTimeout(() => {
        el.hidden = true;
        if (!document.querySelector('.modal-overlay.on') && !document.querySelector('.user-panel.on')) {
            document.body.style.overflow = '';
        }
    }, 250);
}

/* ═══════════════════════════════════
   ۲۱. Auth Form
═══════════════════════════════════ */
function initAuth() {
    const tabs = $$('.auth-tab');
    const forms = $$('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.authTab;
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            forms.forEach(f => {
                const active = f.dataset.authForm === target;
                f.classList.toggle('active', active);
                f.hidden = !active;
            });
        });
    });

    $$('[data-switch-auth]').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = tabs.find(x => x.dataset.authTab === btn.dataset.switchAuth);
            t?.click();
        });
    });

    $$('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            if (input) input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    $('#loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const r = loginUser(fd.get('username'), fd.get('password'));
        if (r.ok) {
            toast('👋 خوش اومدی ' + r.user.displayName);
            closeModal('authOverlay');
            e.target.reset();
        } else toast('❌ ' + r.error);
    });

    $('#registerForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const r = registerUser({
            username: fd.get('username'),
            displayName: fd.get('displayName'),
            password: fd.get('password'),
            platform: fd.get('platform') || 'pc'
        });
        if (r.ok) {
            toast('🎉 خوش اومدی ' + r.user.displayName);
            closeModal('authOverlay');
            e.target.reset();
            setTimeout(() => {
                if (r.user.role === 'admin') toast('👑 تو اولین کاربری، مدیر شدی!');
            }, 800);
        } else toast('❌ ' + r.error);
    });

    $('#userBtnGuest')?.addEventListener('click', () => openModal('authOverlay'));
    $('#drawerLoginBtn')?.addEventListener('click', () => { closeDrawer(); openModal('authOverlay'); });
    $('#userBtn')?.addEventListener('click', () => openPanel());
}

/* ═══════════════════════════════════
   ۲۲. منوی سه‌خطی
═══════════════════════════════════ */
function openDrawer() {
    const d = $('#sideDrawer');
    if (!d) return;
    d.hidden = false;
}

function closeDrawer() {
    const d = $('#sideDrawer');
    if (d) d.hidden = true;
}

function initDrawer() {
    $('#menuBtn')?.addEventListener('click', openDrawer);
    $('#drawerClose')?.addEventListener('click', closeDrawer);
    $('#drawerBackdrop')?.addEventListener('click', closeDrawer);

    $('#drawerForum')?.addEventListener('click', () => {
        const sub = $('#drawerForumSub');
        const link = $('#drawerForum');
        if (sub) {
            sub.classList.toggle('open');
            link.classList.toggle('open');
        }
    });

    $('#drawerMore')?.addEventListener('click', () => {
        const sub = $('#drawerMoreSub');
        const link = $('#drawerMore');
        if (sub) {
            sub.classList.toggle('open');
            link.classList.toggle('open');
        }
    });

    $$('[data-nav]').forEach(el => {
        el.addEventListener('click', () => {
            const page = el.dataset.nav;
            closeDrawer();
            showPage(page);
        });
    });
}

/* ═══════════════════════════════════
   ۲۳. ساخت گروه
═══════════════════════════════════ */
function initGroupCreation() {
    $('#createGroupBtn')?.addEventListener('click', () => {
        if (State.user?.role !== 'admin') { toast('فقط مدیر'); return; }
        openModal('groupModalOverlay');
    });

    $('#groupForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = fd.get('name').trim();
        const description = fd.get('description').trim();
        const type = fd.get('type') || 'public';

        if (!name) return;

        const groups = DB.getGroups();
        const g = {
            id: uid('g_'),
            name, description, type,
            ownerId: State.user.id,
            members: [State.user.id],
            admins: [],
            mods: [],
            banned: [],
            joinRequests: [],
            messages: [],
            avatar: null,
            cover: null,
            createdAt: Date.now()
        };

        groups.push(g);
        DB.setGroups(groups);

        const users = DB.getUsers();
        const me = users.find(u => u.id === State.user.id);
        me.groups = me.groups || [];
        me.groups.push(g.id);
        DB.setUsers(users);
        State.user = me;

        addActivity('group', `${State.user.displayName} گروه «${name}» رو ساخت`);

        toast('✅ گروه ساخته شد');
        closeModal('groupModalOverlay');
        e.target.reset();
        showPage('group', g.id);
    });
}

/* ═══════════════════════════════════
   ۲۴. فیلترها
═══════════════════════════════════ */
function initFilters() {
    $$('#postFilters .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            $$('#postFilters .filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            State.postFilter = chip.dataset.filter;
            renderPosts();
        });
    });

    $$('#timeFilter .time-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            $$('#timeFilter .time-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            State.timeFilter = chip.dataset.time;
            renderTrending();
        });
    });

    $$('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.group-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            State.groupFilter = tab.dataset.groupsTab;
            renderGroupsPage();
        });
    });

    $$('.up-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.up-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderUserPanelBody(tab.dataset.upTab);
        });
    });
}

/* ═══════════════════════════════════
   ۲۵. جستجو
═══════════════════════════════════ */
function initSearch() {
    const input = $('#searchInput');
    const results = $('#searchResults');

    $('#searchBtn')?.addEventListener('click', () => {
        openModal('searchOverlay');
        setTimeout(() => input?.focus(), 300);
    });

    input?.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (q.length < 2) {
            if (results) results.innerHTML = '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">شروع به تایپ کن...</p>';
            return;
        }

        const posts = DB.getPosts().filter(p =>
            p.status === 'published' &&
            ((p.title || '').toLowerCase().includes(q) || stripHtml(p.content).toLowerCase().includes(q))
        ).slice(0, 5);

        const users = DB.getUsers().filter(u =>
            u.username.includes(q) || (u.displayName || '').toLowerCase().includes(q)
        ).slice(0, 5);

        const groups = DB.getGroups().filter(g =>
            g.type === 'public' && (g.name || '').toLowerCase().includes(q)
        ).slice(0, 3);

        let html = '';

        if (posts.length) {
            html += '<div style="font-size:11px;font-weight:800;color:var(--tx-mute);margin:10px 6px;">📰 پست‌ها</div>';
            html += posts.map(p => `
                <div class="search-result-item" data-open-post="${p.id}">
                    <div class="search-result-icon">📰</div>
                    <div class="search-result-info">
                        <strong>${escapeHtml(p.title)}</strong>
                        <small>${faNum(p.views || 0)} بازدید</small>
                    </div>
                </div>
            `).join('');
        }

        if (users.length) {
            html += '<div style="font-size:11px;font-weight:800;color:var(--tx-mute);margin:10px 6px;">👤 کاربران</div>';
            html += users.map(u => `
                <div class="search-result-item">
                    <div class="search-result-icon">${u.avatar ? `<img src="${u.avatar}">` : u.displayName[0]}</div>
                    <div class="search-result-info">
                        <strong>${escapeHtml(u.displayName)}</strong>
                        <small>@${escapeHtml(u.username)}</small>
                    </div>
                </div>
            `).join('');
        }

        if (groups.length) {
            html += '<div style="font-size:11px;font-weight:800;color:var(--tx-mute);margin:10px 6px;">📁 گروه‌ها</div>';
            html += groups.map(g => `
                <div class="search-result-item" data-open-group="${g.id}">
                    <div class="search-result-icon">${g.avatar ? `<img src="${g.avatar}">` : g.name[0]}</div>
                    <div class="search-result-info">
                        <strong>${escapeHtml(g.name)}</strong>
                        <small>${faNum((g.members || []).length)} عضو</small>
                    </div>
                </div>
            `).join('');
        }

        if (!html) html = '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">نتیجه‌ای پیدا نشد</p>';
        if (results) results.innerHTML = html;

        $$('[data-open-post]', results).forEach(el => el.addEventListener('click', () => {
            closeModal('searchOverlay');
            showPage('post', el.dataset.openPost);
        }));
        $$('[data-open-group]', results).forEach(el => el.addEventListener('click', () => {
            closeModal('searchOverlay');
            showPage('group', el.dataset.openGroup);
        }));
    });
}

/* ═══════════════════════════════════
   ۲۶. اسکرول UI
═══════════════════════════════════ */
function initScrollUI() {
    const bar = $('#scrollProgress');
    const nav = $('#navShell');
    const toTop = $('#toTop');

    let raf = null;
    window.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            const y = scrollY;
            const total = document.documentElement.scrollHeight - innerHeight;
            if (bar) bar.style.width = (total > 0 ? (y / total) * 100 : 0) + '%';
            if (nav) nav.classList.toggle('scrolled', y > 40);
            if (toTop) toTop.classList.toggle('show', y > 600);
            raf = null;
        });
    }, { passive: true });

    toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ═══════════════════════════════════
   ۲۷. میانبرهای کیبورد
═══════════════════════════════════ */
function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal('authOverlay');
            closeModal('searchOverlay');
            closeModal('groupModalOverlay');
            closeModal('groupSettingsOverlay');
            closeDrawer();
            closePanel();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openModal('searchOverlay');
        }
    });
}

/* ═══════════════════════════════════
   ۲۸. بستن با data-close
═══════════════════════════════════ */
function initCloseHandlers() {
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close]');
        if (closeBtn) {
            const target = closeBtn.dataset.close;
            if (target === 'auth') closeModal('authOverlay');
            if (target === 'search') closeModal('searchOverlay');
            if (target === 'group') closeModal('groupModalOverlay');
            if (target === 'groupSettings') closeModal('groupSettingsOverlay');
        }
    });
}

/* ═══════════════════════════════════
   ۲۹. متفرقه
═══════════════════════════════════ */
function applyFontSize(val) {
    State.fontSize = val;
    document.documentElement.style.setProperty('--font-scale', val / 100);
    store.set('nova.fontSize', val);
}

/* ═══════════════════════════════════
   ۳۰. Nova API (برای onclick)
═══════════════════════════════════ */
window.Nova = {
    viewImage: (msgId, groupId) => {
        const g = DB.getGroups().find(x => x.id === groupId);
        const m = g?.messages?.find(x => x.id === msgId);
        if (m?.image) window.open(m.image);
    }
};

/* ═══════════════════════════════════
   ۳۱. Boot
═══════════════════════════════════ */
function boot() {
    console.log('%c✦ نووا گیم', 'color:#7c3aed;font-weight:900;font-size:18px;letter-spacing:2px');

    /* تم */
    applyTheme(State.theme);

    /* عملکرد */
    const tier = State.perf === 'auto' ? detectPerf() : State.perf;
    applyPerf(tier);

    /* فونت */
    applyFontSize(State.fontSize);

    /* کاربر */
    State.user = getCurrentUser();
    updateAuthUI();

    /* Init */
    initScrollUI();
    initAuth();
    initEditor();
    initSearch();
    initDrawer();
    initGroupCreation();
    initFilters();
    initKeyboard();
    initCloseHandlers();

    /* Event Listeners */
    $('#themeBtn')?.addEventListener('click', flipTheme);
    $('#notifBtn')?.addEventListener('click', toggleNotifPanel);
    $('#chatBtn')?.addEventListener('click', toggleChatPanel);
    $('#notifClose')?.addEventListener('click', () => { const p = $('#notifPanel'); if (p) p.hidden = true; });
    $('#chatClose')?.addEventListener('click', () => { const p = $('#chatPanel'); if (p) p.hidden = true; });
    $('#userPanelClose')?.addEventListener('click', closePanel);
    $('#createPostBtn')?.addEventListener('click', () => openEditor());

    /* بستن پنل با کلیک بیرون */
    document.addEventListener('click', (e) => {
        const notif = $('#notifPanel');
        const chat = $('#chatPanel');
        if (notif && !notif.hidden && !notif.contains(e.target) && !e.target.closest('#notifBtn')) {
            notif.hidden = true;
        }
        if (chat && !chat.hidden && !chat.contains(e.target) && !e.target.closest('#chatBtn')) {
            chat.hidden = true;
        }
    });

    /* رندر اولیه */
    renderHome();

    /* Visibility pause */
    document.addEventListener('visibilitychange', () => {
        // خیلی سبک، فقط برای صرفه‌جویی
    });

    /* گوش دادن به hash */
    window.addEventListener('hashchange', () => {
        const hash = location.hash.slice(1);
        if (hash && hash.startsWith('post-')) {
            showPage('post', hash.replace('post-', ''));
        }
    });

    console.log('%cمیانبر: Ctrl+K جستجو · Esc بستن', 'color:#a855f7;font-size:11px');
    console.log('%c© ۱۴۰۴ آریا عزیزی', 'color:#d1006b;font-size:11px');
}

boot();
