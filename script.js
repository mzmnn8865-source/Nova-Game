/* ============================================================
   Nova Game — Script
   Author: Aria Azizi
   v2.0
   ============================================================ */

'use strict';

// @ts-nocheck

/* ═══════════════════════════════════
   ۱. ابزارها
═══════════════════════════════════ */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const store = {
    get(k, fb) {
        try { const v = localStorage.getItem(k); return v === null ? fb : v; }
        catch { return fb; }
    },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k)    { try { localStorage.removeItem(k); } catch {} },
    json(k, fb) {
        try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
        catch { return fb; }
    }
};

/* هش ساده برای پسورد (بهبود امنیت اولیه) */
function hashPass(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) + str.charCodeAt(i);
        h = h & h; // 32-bit
    }
    return 'h_' + Math.abs(h).toString(36) + '_' + str.length;
}

/* شماره فارسی */
function faNum(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

/* تولید ID */
function uid(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* تاریخ شمسی */
function faDate(ts = Date.now()) {
    try {
        return new Date(ts).toLocaleDateString('fa-IR', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch { return new Date(ts).toLocaleDateString(); }
}

/* زمان نسبی */
function timeAgo(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'همین الان';
    if (diff < 3600) return `${faNum(Math.floor(diff / 60))} دقیقه پیش`;
    if (diff < 86400) return `${faNum(Math.floor(diff / 3600))} ساعت پیش`;
    if (diff < 604800) return `${faNum(Math.floor(diff / 86400))} روز پیش`;
    return faDate(ts);
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
   ۳. تشخیص سخت‌افزار
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
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            const r = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '').toLowerCase();
            if (r.includes('rtx') || r.includes('apple m')) gpuScore = 3;
            else if (r.includes('radeon rx') || r.includes('gtx 1')) gpuScore = 2;
            else if (r.includes('intel') || r.includes('adreno') || r.includes('mali')) gpuScore = -1;
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

    let tier = 'high';
    if (score <= -2) tier = 'ultra-low';
    else if (score <= 1) tier = 'low';
    else if (score <= 3) tier = 'mid';
    else if (score >= 12) tier = 'ultra';

    return tier;
}

function applyPerf(tier) {
    document.documentElement.dataset.perf = tier;
    console.log(`%c ⚡ Performance: ${tier.toUpperCase()}`, 'color:#7c3aed;font-weight:bold');
}

/* ═══════════════════════════════════
   ۴. سیستم ذخیره‌سازی (شبه دیتابیس)
═══════════════════════════════════ */
const DB = {
    KEY_USERS:    'nova.users',
    KEY_POSTS:    'nova.posts',
    KEY_SESSION:  'nova.session',
    KEY_SETTINGS: 'nova.settings',
    KEY_FRIENDS:  'nova.friends',
    KEY_MESSAGES: 'nova.messages',
    KEY_NOTIFS:   'nova.notifs',
    KEY_REPORTS:  'nova.reports',

    getUsers()    { return store.json(this.KEY_USERS, []); },
    setUsers(u)   { store.set(this.KEY_USERS, JSON.stringify(u)); },

    getPosts()    { return store.json(this.KEY_POSTS, []); },
    setPosts(p)   { store.set(this.KEY_POSTS, JSON.stringify(p)); },

    getSession()  { return store.json(this.KEY_SESSION, null); },
    setSession(s) { store.set(this.KEY_SESSION, JSON.stringify(s)); },
    clearSession(){ store.del(this.KEY_SESSION); },

    getSettings() { return store.json(this.KEY_SETTINGS, {}); },
    setSettings(s){ store.set(this.KEY_SETTINGS, JSON.stringify(s)); },

    getFriends()  { return store.json(this.KEY_FRIENDS, {}); },
    setFriends(f) { store.set(this.KEY_FRIENDS, JSON.stringify(f)); },

    getMessages() { return store.json(this.KEY_MESSAGES, []); },
    setMessages(m){ store.set(this.KEY_MESSAGES, JSON.stringify(m)); },

    getNotifs()   { return store.json(this.KEY_NOTIFS, []); },
    setNotifs(n)  { store.set(this.KEY_NOTIFS, JSON.stringify(n)); },

    getReports()  { return store.json(this.KEY_REPORTS, []); },
    setReports(r) { store.set(this.KEY_REPORTS, JSON.stringify(r)); }
};

/* ═══════════════════════════════════
   ۵. State
═══════════════════════════════════ */
const State = {
    theme:    store.get('nova.theme', 'light'),
    perf:     store.get('nova.perf', 'auto'),
    fontSize: +store.get('nova.fontSize', 100),
    currentUser: null,
    currentFilter: 'all',
    activePanel: null,
    editorPostId: null
};

/* ═══════════════════════════════════
   ۶. تم روز/شب/اتوماتیک
═══════════════════════════════════ */
function applyTheme(theme) {
    let finalTheme = theme;

    if (theme === 'auto') {
        const h = new Date().getHours();
        finalTheme = (h >= 7 && h < 19) ? 'light' : 'dark';
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('light', finalTheme === 'light');
    document.documentElement.classList.toggle('dark', finalTheme === 'dark');
    document.documentElement.style.colorScheme = finalTheme;

    State.theme = theme;
    store.set('nova.theme', theme);

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = finalTheme === 'light' ? '#f5f7fb' : '#06060d';
}

function flipTheme() {
    const order = ['light', 'dark', 'auto'];
    const idx = order.indexOf(State.theme);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);

    const labels = { light: '☀️ حالت روز', dark: '🌙 حالت شب', auto: '🌗 حالت خودکار' };
    toast(labels[next]);
}

/* هر ۶۰ ثانیه تم اتوماتیک رو چک کن */
setInterval(() => {
    if (State.theme === 'auto') applyTheme('auto');
}, 60000);

/* ═══════════════════════════════════
   ۷. کاربر — Auth
═══════════════════════════════════ */
function getCurrentUser() {
    const session = DB.getSession();
    if (!session) return null;
    const users = DB.getUsers();
    return users.find(u => u.id === session.userId) || null;
}

function saveCurrentUser() {
    State.currentUser = getCurrentUser();
    updateAuthUI();
}

function registerUser({ username, displayName, password, platform }) {
    const users = DB.getUsers();
    const clean = username.toLowerCase().trim();

    if (!/^[a-z][a-z0-9_]{2,19}$/.test(clean)) {
        return { ok: false, error: 'نام کاربری باید با حروف انگلیسی، اعداد یا _ باشه (۳ تا ۲۰ کاراکتر)' };
    }

    if (users.some(u => u.username === clean)) {
        return { ok: false, error: 'این نام کاربری قبلا گرفته شده' };
    }

    if (password.length < 6) {
        return { ok: false, error: 'رمز باید حداقل ۶ کاراکتر باشه' };
    }

    const user = {
        id: uid('u_'),
        username: clean,
        displayName: displayName.trim() || clean,
        passHash: hashPass(password),
        platform: platform || 'pc',
        avatar: null,
        cover: null,
        bio: '',
        role: 'user',              // user | author | admin
        verified: false,
        level: 1,
        xp: 0,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        friends: [],
        friendRequests: [],
        blocked: [],
        favorites: [],
        social: {}
    };

    users.push(user);
    DB.setUsers(users);

    /* اولین کاربر = مدیر */
    if (users.length === 1) {
        user.role = 'admin';
        user.verified = true;
        DB.setUsers(users);
        console.log('%c 👑 اولین کاربر به‌عنوان مدیر تنظیم شد', 'color:#ea580c;font-weight:bold');
    }

    DB.setSession({ userId: user.id, ts: Date.now() });
    State.currentUser = user;
    updateAuthUI();

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
    State.currentUser = user;
    updateAuthUI();

    return { ok: true, user };
}

function logoutUser() {
    DB.clearSession();
    State.currentUser = null;
    updateAuthUI();
    toast('👋 خارج شدی');
}

/* ═══════════════════════════════════
   ۸. به‌روزرسانی UI بعد از Auth
═══════════════════════════════════ */
function updateAuthUI() {
    const user = State.currentUser;
    const guestBtn = $('#userBtnGuest');
    const loggedBtn = $('#userBtn');
    const navAvatar = $('#navAvatar');
    const navName = $('#navName');
    const createBtn = $('#createPostBtn');
    const chatBtn = $('#chatBtn');
    const notifBtn = $('#notifBtn');
    const emptyCreateBtn = $('#emptyCreateBtn');

    if (!guestBtn || !loggedBtn) return;

    if (user) {
        guestBtn.hidden = true;
        loggedBtn.hidden = false;
        navName.textContent = user.displayName;

        /* آواتار */
        navAvatar.innerHTML = '';
        if (user.avatar) {
            const img = document.createElement('img');
            img.src = user.avatar;
            img.alt = user.displayName;
            navAvatar.appendChild(img);
        } else {
            navAvatar.textContent = (user.displayName || 'U')[0].toUpperCase();
        }

        /* دکمه ساخت پست (فقط نویسنده و مدیر) */
        const canCreate = user.role === 'admin' || user.role === 'author';
        if (createBtn) createBtn.hidden = !canCreate;
        if (emptyCreateBtn) emptyCreateBtn.hidden = !canCreate;

        /* چت و اعلان */
        if (chatBtn) chatBtn.hidden = false;
        if (notifBtn) notifBtn.hidden = false;

        /* بررسی درخواست‌های دوستی */
        updateFriendBadge();
        updateNotifBadge();
    } else {
        guestBtn.hidden = false;
        loggedBtn.hidden = true;
        if (createBtn) createBtn.hidden = true;
        if (emptyCreateBtn) emptyCreateBtn.hidden = true;
        if (chatBtn) chatBtn.hidden = true;
        if (notifBtn) notifBtn.hidden = true;
    }

    renderPosts();
    updateStats();
}

function updateFriendBadge() {
    const badge = $('#chatBadge');
    if (!badge || !State.currentUser) return;
    const requests = (State.currentUser.friendRequests || []).length;
    badge.hidden = requests === 0;
    badge.textContent = faNum(requests);
}

function updateNotifBadge() {
    const badge = $('#notifBadge');
    if (!badge) return;
    const notifs = DB.getNotifs().filter(n => !n.read);
    badge.hidden = notifs.length === 0;
    badge.textContent = faNum(notifs.length);
}

/* ═══════════════════════════════════
   ۹. پست‌ها
═══════════════════════════════════ */
function createPost(data) {
    const user = State.currentUser;
    if (!user) return { ok: false, error: 'اول وارد شو' };
    if (user.role !== 'admin' && user.role !== 'author') {
        return { ok: false, error: 'فقط نویسنده‌ها و مدیران می‌تونن پست بسازن' };
    }

    const posts = DB.getPosts();
    const post = {
        id: data.id || uid('p_'),
        title: data.title || 'بدون عنوان',
        content: data.content || '',
        excerpt: data.excerpt || '',
        cover: data.cover || null,
        category: data.category || 'news',
        platform: data.platform || 'all',
        tags: data.tags || [],
        score: data.score || null,
        status: data.status || 'published',
        authorId: user.id,
        authorName: user.displayName,
        authorAvatar: user.avatar,
        createdAt: data.createdAt || Date.now(),
        updatedAt: Date.now(),
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || []
    };

    const existing = posts.findIndex(p => p.id === post.id);
    if (existing > -1) {
        posts[existing] = post;
    } else {
        posts.unshift(post);
    }

    DB.setPosts(posts);

    /* XP برای نویسنده */
    if (existing === -1) {
        const users = DB.getUsers();
        const u = users.find(x => x.id === user.id);
        if (u) {
            u.xp = (u.xp || 0) + 15;
            u.level = Math.floor(u.xp / 100) + 1;
            DB.setUsers(users);
            State.currentUser = u;
        }
    }

    return { ok: true, post };
}

function deletePost(postId) {
    const user = State.currentUser;
    if (!user) return false;

    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return false;

    if (user.role !== 'admin' && post.authorId !== user.id) {
        toast('❌ اجازه‌ی حذف این پست رو نداری');
        return false;
    }

    const filtered = posts.filter(p => p.id !== postId);
    DB.setPosts(filtered);
    return true;
}

function getPostsByCategory(cat) {
    const posts = DB.getPosts();
    if (cat === 'all') return posts;
    return posts.filter(p => p.category === cat && p.status === 'published');
}

/* ═══════════════════════════════════
   ۱۰. رندر پست‌ها
═══════════════════════════════════ */
function renderPosts() {
    const grid = $('#newsGrid');
    const emptyEl = $('#emptyNews');
    if (!grid) return;

    const posts = getPostsByCategory(State.currentFilter);

    if (posts.length === 0) {
        grid.innerHTML = '';
        if (emptyEl) grid.appendChild(emptyEl);
        return;
    }

    grid.innerHTML = '';
    posts.slice(0, 12).forEach(post => {
        grid.appendChild(createPostCard(post));
    });
}

function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'news-card glass';
    card.dataset.id = post.id;

    const catLabel = {
        news: 'خبر', review: 'نقد', guide: 'راهنما', esport: 'ای‌اسپورت'
    }[post.category] || 'خبر';

    const coverStyle = post.cover
        ? `background: linear-gradient(135deg, var(--accent), var(--accent-2)); background-image: url('${post.cover}'); background-size: cover; background-position: center;`
        : `background: linear-gradient(135deg, var(--accent), var(--accent-2));`;

    card.innerHTML = `
        <div class="news-thumb" style="${coverStyle}">
            <span class="thumb-badge">${catLabel}</span>
        </div>
        <div class="news-body">
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt || stripHtml(post.content).slice(0, 120))}</p>
            <div class="news-meta">
                <span>${timeAgo(post.createdAt)}</span>
                <span class="dot"></span>
                <span>${faNum(post.views || 0)} بازدید</span>
                <span class="dot"></span>
                <span>${faNum(Math.ceil((post.content || '').length / 900))} دقیقه</span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openPost(post.id));
    return card;
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

/* ═══════════════════════════════════
   ۱۱. نمایش پست
═══════════════════════════════════ */
function openPost(postId) {
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    /* افزایش بازدید */
    post.views = (post.views || 0) + 1;
    DB.setPosts(posts);

    const overlay = $('#postOverlay');
    const content = $('#postContent');
    if (!overlay || !content) return;

    const catLabel = {
        news: 'خبر', review: 'نقد', guide: 'راهنما', esport: 'ای‌اسپورت'
    }[post.category] || 'خبر';

    content.innerHTML = `
        ${post.cover ? `
            <div class="post-cover">
                <img src="${post.cover}" alt="${escapeHtml(post.title)}">
            </div>
        ` : ''}

        <div class="post-header">
            <span class="post-cat">${catLabel}${post.score ? ` · ${faNum(post.score)}/۱۰` : ''}</span>
            <h1>${escapeHtml(post.title)}</h1>
            <div class="post-meta">
                <div class="post-author-mini">
                    <div class="avatar">${post.authorAvatar ? `<img src="${post.authorAvatar}">` : (post.authorName || 'N')[0]}</div>
                    <strong>${escapeHtml(post.authorName || 'ناشناس')}</strong>
                </div>
                <span class="dot"></span>
                <span>${timeAgo(post.createdAt)}</span>
                <span class="dot"></span>
                <span>${faNum(post.views || 0)} بازدید</span>
            </div>
        </div>

        <div class="post-body">${post.content}</div>
    `;

    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('on'));
    document.body.style.overflow = 'hidden';
}

/* ═══════════════════════════════════
   ۱۲. آمار
═══════════════════════════════════ */
function updateStats() {
    const users = DB.getUsers();
    const posts = DB.getPosts();
    const authors = users.filter(u => u.role === 'author' || u.role === 'admin');
    const comments = posts.reduce((sum, p) => sum + (p.comments?.length || 0), 0);

    const setStat = (id, val) => {
        const el = $(id);
        if (el) animateNumber(el, val);
    };

    setStat('#statPosts', posts.length);
    setStat('#statUsers', users.length);
    setStat('#statAuthors', authors.length);
    setStat('#statComments', comments);
}

function animateNumber(el, target) {
    const start = +el.textContent.replace(/[^\d]/g, '') || 0;
    const dur = 800;
    const t0 = performance.now();

    function frame(t) {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.floor(start + (target - start) * eased);
        el.textContent = faNum(val);
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = faNum(target);
    }
    requestAnimationFrame(frame);
}

/* ═══════════════════════════════════
   ۱۳. Preloader
═══════════════════════════════════ */
function initPreloader() {
    const pre = $('#preloader');
    const fill = $('#preloaderFill');
    const pct = $('#preloaderPercent');
    if (!pre) return;

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 12 + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                pre.classList.add('done');
                document.body.style.overflow = '';
                setTimeout(() => pre.remove(), 800);
            }, 300);
        }
        if (fill) fill.style.width = progress + '%';
        if (pct) pct.textContent = faNum(Math.floor(progress)) + '٪';
    }, 120);
}

/* ═══════════════════════════════════
   ۱۴. ستاره‌ها و شهاب‌سنگ‌ها
═══════════════════════════════════ */
function generateStars() {
    const layer = $('#starsLayer');
    if (!layer) return;

    const tier = document.documentElement.dataset.perf || 'high';
    let count = 80;
    if (tier === 'ultra-low' || tier === 'low') count = 20;
    else if (tier === 'mid') count = 50;

    layer.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        const size = Math.random() * 2 + 1;
        s.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation-duration: ${2 + Math.random() * 4}s;
            animation-delay: ${Math.random() * 4}s;
        `;
        frag.appendChild(s);
    }
    layer.appendChild(frag);
}

function spawnShootingStar() {
    const layer = $('#shootingStars');
    if (!layer) return;

    const tier = document.documentElement.dataset.perf || 'high';
    if (tier === 'ultra-low' || tier === 'low' || tier === 'mid') return;

    const star = document.createElement('div');
    star.className = 'shooting-star';
    const startX = Math.random() * innerWidth;
    star.style.cssText = `
        top: ${Math.random() * 40}%;
        left: ${startX}px;
        opacity: 0;
    `;
    layer.appendChild(star);

    if (window.gsap) {
        gsap.timeline()
            .set(star, { opacity: 1, x: 0, y: 0 })
            .to(star, {
                x: -(200 + Math.random() * 200),
                y: 200 + Math.random() * 200,
                duration: 1.5 + Math.random(),
                ease: 'power2.in',
                onComplete: () => star.remove()
            });
    } else {
        setTimeout(() => star.remove(), 2500);
    }
}

setInterval(spawnShootingStar, 4500);

/* ═══════════════════════════════════
   ۱۵. نوار پیشرفت + هدر + بازگشت به بالا
═══════════════════════════════════ */
function initScrollUI() {
    const bar = $('#scrollProgress');
    const nav = $('#navShell');
    const toTop = $('#toTop');

    let raf = null;
    window.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            const y = window.scrollY;
            const total = document.documentElement.scrollHeight - innerHeight;
            const pct = total > 0 ? (y / total) * 100 : 0;

            if (bar) bar.style.width = pct + '%';
            if (nav) nav.classList.toggle('scrolled', y > 40);
            if (toTop) toTop.classList.toggle('show', y > 600);

            raf = null;
        });
    }, { passive: true });

    toTop?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* ═══════════════════════════════════
   ۱۶. مودال‌ها
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
        if (!document.querySelector('.modal-overlay.on, .side-panel.on')) {
            document.body.style.overflow = '';
        }
    }, 300);
}

function closeAllModals() {
    $$('.modal-overlay.on').forEach(el => {
        const id = el.id;
        if (id) closeModal(id);
    });
    $$('.side-panel.on').forEach(el => {
        el.classList.remove('on');
    });
    const backdrop = $('#panelBackdrop');
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = '';
}

/* بستن با data-close */
document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
        const target = closeBtn.dataset.close;
        if (target === 'auth')    closeModal('authOverlay');
        if (target === 'editor')  closeModal('editorOverlay');
        if (target === 'post')    closeModal('postOverlay');
        if (target === 'search')  closeModal('searchOverlay');
        if (target === 'user')    closePanel('user');
        if (target === 'admin')   closePanel('admin');
        if (target === 'author')  closePanel('author');
    }
});

/* Escape */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openModal('searchOverlay');
    }
});

/* ═══════════════════════════════════
   ۱۷. Auth Modal
═══════════════════════════════════ */
function initAuth() {
    const overlay = $('#authOverlay');
    const tabs = $$('.auth-tab');
    const forms = $$('.auth-form');

    /* سوییچ تب */
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.authTab;
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            forms.forEach(f => {
                const isActive = f.dataset.authForm === target;
                f.classList.toggle('active', isActive);
                f.hidden = !isActive;
            });
        });
    });

    /* دکمه‌های سوییچ */
    $$('[data-switch-auth]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.switchAuth;
            const tab = tabs.find(t => t.dataset.authTab === target);
            tab?.click();
        });
    });

    /* نمایش رمز */
    $$('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    /* فرم ورود */
    $('#loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const result = loginUser(fd.get('username'), fd.get('password'));
        if (result.ok) {
            toast('👋 خوش اومدی ' + result.user.displayName);
            closeModal('authOverlay');
            e.target.reset();
        } else {
            toast('❌ ' + result.error);
        }
    });

    /* فرم ثبت‌نام */
    $('#registerForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const result = registerUser({
            username: fd.get('username'),
            displayName: fd.get('displayName'),
            password: fd.get('password'),
            platform: fd.get('platform') || 'pc'
        });
        if (result.ok) {
            toast('🎉 خوش اومدی ' + result.user.displayName);
            closeModal('authOverlay');
            e.target.reset();
        } else {
            toast('❌ ' + result.error);
        }
    });

    /* دکمه‌های باز کردن Auth */
    $('#userBtnGuest')?.addEventListener('click', () => openModal('authOverlay'));
    $('#ctaRegisterBtn')?.addEventListener('click', () => {
        openModal('authOverlay');
        setTimeout(() => $('[data-switch-auth="register"]')?.click(), 100);
    });
    $('#ctaLoginBtn')?.addEventListener('click', () => openModal('authOverlay'));
    $('#mobileLoginBtn')?.addEventListener('click', () => {
        closeMobileMenu();
        openModal('authOverlay');
    });

    /* دکمه کاربر لاگین شده */
    $('#userBtn')?.addEventListener('click', () => {
        openPanel('user');
    });
}

/* ═══════════════════════════════════
   ۱۸. پنل‌های کناری
═══════════════════════════════════ */
function openPanel(type) {
    closeAllModals();

    const map = { user: 'userPanel', admin: 'adminPanel', author: 'authorPanel' };
    const panel = document.getElementById(map[type]);
    const backdrop = $('#panelBackdrop');
    if (!panel) return;

    /* چک دسترسی */
    const user = State.currentUser;
    if (type === 'user' && !user) {
        openModal('authOverlay');
        return;
    }
    if (type === 'admin' && (!user || user.role !== 'admin')) {
        toast('❌ فقط مدیر دسترسی دارد');
        return;
    }
    if (type === 'author' && (!user || (user.role !== 'author' && user.role !== 'admin'))) {
        toast('❌ فقط نویسنده‌ها دسترسی دارند');
        return;
    }

    /* پر کردن محتوا */
    if (type === 'user')   renderUserPanel();
    if (type === 'admin')  renderAdminPanel();
    if (type === 'author') renderAuthorPanel();

    panel.classList.add('on');
    if (backdrop) backdrop.hidden = false;
    requestAnimationFrame(() => backdrop?.classList.add('on'));
    document.body.style.overflow = 'hidden';

    State.activePanel = type;
}

function closePanel(type) {
    const map = { user: 'userPanel', admin: 'adminPanel', author: 'authorPanel' };
    const panel = document.getElementById(map[type]);
    const backdrop = $('#panelBackdrop');

    if (panel) panel.classList.remove('on');
    if (backdrop) {
        backdrop.classList.remove('on');
        setTimeout(() => {
            backdrop.hidden = true;
            if (!document.querySelector('.side-panel.on')) {
                document.body.style.overflow = '';
            }
        }, 350);
    }
    State.activePanel = null;
}

$('#panelBackdrop')?.addEventListener('click', () => {
    $$('.side-panel.on').forEach(p => p.classList.remove('on'));
    const b = $('#panelBackdrop');
    if (b) { b.classList.remove('on'); setTimeout(() => b.hidden = true, 350); }
    document.body.style.overflow = '';
});

/* تب‌های داخل پنل */
$$('.side-panel').forEach(panel => {
    panel.querySelectorAll('.side-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const group = tab.dataset.userTab ? 'user-tab' :
                          tab.dataset.adminTab ? 'admin-tab' :
                          tab.dataset.authorTab ? 'author-tab' : null;
            if (!group) return;

            const key = tab.dataset.userTab || tab.dataset.adminTab || tab.dataset.authorTab;

            panel.querySelectorAll('.side-tab').forEach(t => t.classList.toggle('active', t === tab));
            panel.querySelectorAll('.side-tab-content').forEach(c => {
                c.classList.toggle('active', c.dataset.tabContent === key);
            });
        });
    });
});

/* ═══════════════════════════════════
   ۱۹. پنل کاربر
═══════════════════════════════════ */
function renderUserPanel() {
    const body = $('#userPanelBody');
    const user = State.currentUser;
    if (!body || !user) return;

    const avatar = user.avatar
        ? `<img src="${user.avatar}" alt="${escapeHtml(user.displayName)}">`
        : (user.displayName || 'U')[0].toUpperCase();

    const platformLabel = {
        ps5: 'PlayStation 5', xbox: 'Xbox', switch: 'Nintendo Switch',
        pc: 'PC', mobile: 'Mobile'
    }[user.platform] || 'PC';

    const friends = DB.getFriends();
    const myFriends = friends[user.id] || [];
    const messages = DB.getMessages().filter(m => m.to === user.id || m.from === user.id);

    body.innerHTML = `
        <!-- پروفایل -->
        <div class="side-tab-content active" data-tab-content="profile">
            <div class="panel-card" style="text-align:center;">
                <div class="user-avatar" style="width:80px;height:80px;font-size:32px;margin:0 auto 14px;">
                    ${avatar}
                </div>
                <h3 style="font-size:18px;font-weight:900;margin-bottom:4px;">${escapeHtml(user.displayName)}</h3>
                <p style="font-size:13px;color:var(--tx-mute);direction:ltr;">@${escapeHtml(user.username)}</p>
                ${user.bio ? `<p style="font-size:13px;color:var(--tx-dim);margin-top:12px;">${escapeHtml(user.bio)}</p>` : ''}
                <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
                    <span class="platform-chip"><span>${platformLabel}</span></span>
                    ${user.verified ? '<span class="platform-chip"><span>✓ تاییدشده</span></span>' : ''}
                </div>
                <button class="btn-primary full" id="editProfileBtn" style="margin-top:16px;">
                    ویرایش پروفایل
                </button>
            </div>

            <div class="panel-stats-grid">
                <div class="panel-stat-box">
                    <strong>${faNum(user.level || 1)}</strong>
                    <span>سطح</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(user.xp || 0)}</strong>
                    <span>XP</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(myFriends.length)}</strong>
                    <span>دوست</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(messages.length)}</strong>
                    <span>پیام</span>
                </div>
            </div>
        </div>

        <!-- دوستان -->
        <div class="side-tab-content" data-tab-content="friends">
            <div class="panel-card">
                <h4>درخواست‌های دوستی</h4>
                <div id="friendRequestsList">
                    ${renderFriendRequests(user)}
                </div>
            </div>

            <div class="panel-card">
                <h4>دوستان من (${faNum(myFriends.length)})</h4>
                <div id="friendsList">
                    ${myFriends.length === 0 ? '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:20px;">هنوز دوستی نداری</p>' : ''}
                    ${myFriends.map(fid => {
                        const f = DB.getUsers().find(u => u.id === fid);
                        if (!f) return '';
                        return `
                            <div class="panel-row">
                                <div class="panel-stat">
                                    <div class="user-avatar" style="width:32px;height:32px;font-size:13px;">
                                        ${f.avatar ? `<img src="${f.avatar}">` : f.displayName[0]}
                                    </div>
                                    <div>
                                        <strong style="font-size:13px;color:var(--tx);">${escapeHtml(f.displayName)}</strong>
                                        <div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@${escapeHtml(f.username)}</div>
                                    </div>
                                </div>
                                <button class="btn-ghost small" onclick="Nova.startChat('${f.id}')">پیام</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="panel-card">
                <h4>جستجوی کاربران</h4>
                <div class="input-wrap" style="margin-bottom:12px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input type="text" id="userSearch" placeholder="جستجوی نام کاربری...">
                </div>
                <div id="userSearchResults"></div>
            </div>
        </div>

        <!-- پیام‌ها -->
        <div class="side-tab-content" data-tab-content="messages">
            <div class="panel-card">
                <h4>پیام‌ها (${faNum(messages.length)})</h4>
                ${messages.length === 0 ? '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:20px;">هنوز پیامی نداری</p>' : `
                    <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;">
                        ${messages.slice(-20).reverse().map(m => {
                            const other = m.from === user.id ? m.to : m.from;
                            const otherUser = DB.getUsers().find(u => u.id === other);
                            const isMine = m.from === user.id;
                            return `
                                <div style="padding:10px;border-radius:12px;background:var(--field);border:1px solid var(--bd);">
                                    <div style="font-size:11px;color:var(--tx-mute);margin-bottom:4px;">
                                        ${isMine ? 'شما →' : `از ${escapeHtml(otherUser?.displayName || 'کاربر')} →`} ${timeAgo(m.ts)}
                                    </div>
                                    <div style="font-size:13px;color:var(--tx-dim);">${escapeHtml(m.text)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        </div>

        <!-- تنظیمات -->
        <div class="side-tab-content" data-tab-content="settings">
            <div class="panel-card">
                <h4>تنظیمات نمایش</h4>
                <div class="panel-row">
                    <span>تم</span>
                    <select id="panelTheme" style="padding:6px 10px;border-radius:8px;background:var(--field);border:1px solid var(--bd);font-size:12px;">
                        <option value="light" ${State.theme === 'light' ? 'selected' : ''}>روز</option>
                        <option value="dark" ${State.theme === 'dark' ? 'selected' : ''}>شب</option>
                        <option value="auto" ${State.theme === 'auto' ? 'selected' : ''}>خودکار</option>
                    </select>
                </div>
                <div class="panel-row">
                    <span>اندازه فونت</span>
                    <input type="range" id="panelFontSize" min="90" max="120" step="5" value="${State.fontSize}" style="width:120px;">
                </div>
            </div>

            <div class="panel-card">
                <h4>عملیات حساب</h4>
                <button class="btn-ghost full" id="logoutBtn" style="color:var(--nova-red);border-color:var(--nova-red);">
                    خروج از حساب
                </button>
            </div>
        </div>
    `;

    /* Event Listeners */
    $('#logoutBtn')?.addEventListener('click', () => {
        logoutUser();
        closePanel('user');
    });

    $('#panelTheme')?.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });

    $('#panelFontSize')?.addEventListener('input', (e) => {
        applyFontSize(+e.target.value);
    });

    $('#userSearch')?.addEventListener('input', (e) => {
        searchUsers(e.target.value);
    });

    /* درخواست‌های دوستی */
    $$('[data-friend-accept]').forEach(btn => {
        btn.addEventListener('click', () => {
            acceptFriendRequest(btn.dataset.friendAccept);
        });
    });

    $$('[data-friend-reject]').forEach(btn => {
        btn.addEventListener('click', () => {
            rejectFriendRequest(btn.dataset.friendReject);
        });
    });

    $('#editProfileBtn')?.addEventListener('click', editProfile);
}

function renderFriendRequests(user) {
    const requests = user.friendRequests || [];
    if (requests.length === 0) {
        return '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:10px;">درخواستی نداری</p>';
    }

    const users = DB.getUsers();
    return requests.map(reqId => {
        const req = users.find(u => u.id === reqId);
        if (!req) return '';
        return `
            <div class="panel-row">
                <div class="panel-stat">
                    <div class="user-avatar" style="width:32px;height:32px;font-size:13px;">
                        ${req.avatar ? `<img src="${req.avatar}">` : req.displayName[0]}
                    </div>
                    <div>
                        <strong style="font-size:13px;color:var(--tx);">${escapeHtml(req.displayName)}</strong>
                        <div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@${escapeHtml(req.username)}</div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;">
                    <button class="btn-primary small" data-friend-accept="${req.id}">قبول</button>
                    <button class="btn-ghost small" data-friend-reject="${req.id}">رد</button>
                </div>
            </div>
        `;
    }).join('');
}

function searchUsers(query) {
    const box = $('#userSearchResults');
    if (!box) return;

    if (!query || query.length < 2) {
        box.innerHTML = '';
        return;
    }

    const q = query.toLowerCase();
    const users = DB.getUsers().filter(u =>
        u.id !== State.currentUser?.id &&
        u.username.toLowerCase().includes(q)
    ).slice(0, 10);

    if (users.length === 0) {
        box.innerHTML = '<p style="font-size:12px;color:var(--tx-mute);text-align:center;padding:10px;">کاربری پیدا نشد</p>';
        return;
    }

    box.innerHTML = users.map(u => `
        <div class="panel-row">
            <div class="panel-stat">
                <div class="user-avatar" style="width:32px;height:32px;font-size:13px;">
                    ${u.avatar ? `<img src="${u.avatar}">` : u.displayName[0]}
                </div>
                <div>
                    <strong style="font-size:13px;color:var(--tx);">${escapeHtml(u.displayName)}</strong>
                    <div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@${escapeHtml(u.username)}</div>
                </div>
            </div>
            <button class="btn-primary small" onclick="Nova.sendFriendRequest('${u.id}')">+ دوستی</button>
        </div>
    `).join('');
}

/* ═══════════════════════════════════
   ۲۰. دوستان
═══════════════════════════════════ */
function sendFriendRequest(targetId) {
    const user = State.currentUser;
    if (!user) return;

    const users = DB.getUsers();
    const target = users.find(u => u.id === targetId);
    const me = users.find(u => u.id === user.id);

    if (!target || !me) return;

    if (me.friends?.includes(targetId)) {
        toast('این کاربر قبلا دوستته');
        return;
    }

    if (target.friendRequests?.includes(me.id)) {
        toast('قبلا درخواست فرستادی');
        return;
    }

    target.friendRequests = target.friendRequests || [];
    target.friendRequests.push(me.id);
    DB.setUsers(users);
    State.currentUser = me;

    /* نوتیفیکیشن */
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

    toast('✅ درخواست دوستی ارسال شد');
}

function acceptFriendRequest(fromId) {
    const user = State.currentUser;
    if (!user) return;

    const users = DB.getUsers();
    const me = users.find(u => u.id === user.id);
    const other = users.find(u => u.id === fromId);

    if (!me || !other) return;

    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    me.friends = me.friends || [];
    other.friends = other.friends || [];

    if (!me.friends.includes(fromId)) me.friends.push(fromId);
    if (!other.friends.includes(me.id)) other.friends.push(me.id);

    DB.setUsers(users);
    State.currentUser = me;
    updateFriendBadge();
    renderUserPanel();
    toast('✅ حالا دوست شدید');
}

function rejectFriendRequest(fromId) {
    const user = State.currentUser;
    if (!user) return;

    const users = DB.getUsers();
    const me = users.find(u => u.id === user.id);
    if (!me) return;

    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    DB.setUsers(users);
    State.currentUser = me;
    updateFriendBadge();
    renderUserPanel();
    toast('درخواست رد شد');
}

/* ═══════════════════════════════════
   ۲۱. ویرایش پروفایل
═══════════════════════════════════ */
function editProfile() {
    const user = State.currentUser;
    if (!user) return;

    const newName = prompt('نام نمایشی جدید:', user.displayName);
    if (newName === null) return;

    const newBio = prompt('بیو جدید (اختیاری):', user.bio || '');
    if (newBio === null) return;

    const users = DB.getUsers();
    const me = users.find(u => u.id === user.id);
    if (!me) return;

    me.displayName = newName.trim() || me.displayName;
    me.bio = newBio.trim();

    DB.setUsers(users);
    State.currentUser = me;
    updateAuthUI();
    renderUserPanel();
    toast('✅ پروفایل ذخیره شد');
}

/* ═══════════════════════════════════
   ۲۲. پیام‌ها (چت)
═══════════════════════════════════ */
function startChat(targetId) {
    const user = State.currentUser;
    if (!user) return;

    const text = prompt('پیام خود را بنویسید:');
    if (!text || !text.trim()) return;

    const messages = DB.getMessages();
    messages.push({
        id: uid('m_'),
        from: user.id,
        to: targetId,
        text: text.trim(),
        ts: Date.now(),
        read: false
    });
    DB.setMessages(messages);

    /* نوتیفیکیشن */
    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'),
        userId: targetId,
        type: 'message',
        text: `${user.displayName} بهت پیام داد`,
        from: user.id,
        ts: Date.now(),
        read: false
    });
    DB.setNotifs(notifs);

    toast('✅ پیام ارسال شد');
}

/* ═══════════════════════════════════
   ۲۳. پنل مدیر
═══════════════════════════════════ */
function renderAdminPanel() {
    const body = $('#adminPanelBody');
    const user = State.currentUser;
    if (!body || !user) return;

    const users = DB.getUsers();
    const posts = DB.getPosts();
    const reports = DB.getReports();

    const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments?.length || 0), 0);

    body.innerHTML = `
        <!-- داشبورد -->
        <div class="side-tab-content active" data-tab-content="dashboard">
            <div class="panel-stats-grid">
                <div class="panel-stat-box">
                    <strong>${faNum(users.length)}</strong>
                    <span>کاربر</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(posts.length)}</strong>
                    <span>پست</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(totalViews)}</strong>
                    <span>بازدید</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(totalComments)}</strong>
                    <span>کامنت</span>
                </div>
            </div>

            <div class="panel-card">
                <h4>آخرین پست‌ها</h4>
                ${posts.slice(0, 5).map(p => `
                    <div class="panel-row">
                        <span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:right;max-width:220px;">${escapeHtml(p.title)}</span>
                        <span style="font-size:11px;color:var(--tx-mute);">${timeAgo(p.createdAt)}</span>
                    </div>
                `).join('') || '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:20px;">هنوز پستی نیست</p>'}
            </div>
        </div>

        <!-- پست‌ها -->
        <div class="side-tab-content" data-tab-content="posts">
            <div class="panel-card">
                <h4>همه پست‌ها (${faNum(posts.length)})</h4>
                <div id="adminPostsList">
                    ${posts.length === 0 ? '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:20px;">هنوز پستی نیست</p>' :
                        posts.map(p => `
                            <div class="panel-row">
                                <div style="flex:1;min-width:0;">
                                    <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:right;">${escapeHtml(p.title)}</div>
                                    <div style="font-size:11px;color:var(--tx-mute);">${p.authorName || 'نامشخص'} · ${timeAgo(p.createdAt)}</div>
                                </div>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn-ghost small" onclick="Nova.editPost('${p.id}')">✎</button>
                                    <button class="btn-ghost small" onclick="Nova.deletePost('${p.id}')" style="color:var(--nova-red);">🗑</button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>

        <!-- کاربران -->
        <div class="side-tab-content" data-tab-content="users">
            <div class="panel-card">
                <h4>همه کاربران (${faNum(users.length)})</h4>
                ${users.map(u => `
                    <div class="panel-row">
                        <div class="panel-stat">
                            <div class="user-avatar" style="width:32px;height:32px;font-size:13px;">
                                ${u.avatar ? `<img src="${u.avatar}">` : u.displayName[0]}
                            </div>
                            <div>
                                <div style="font-size:13px;font-weight:700;color:var(--tx);">${escapeHtml(u.displayName)}</div>
                                <div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@${escapeHtml(u.username)} · ${u.role}</div>
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <select onchange="Nova.changeRole('${u.id}', this.value)" style="padding:4px 8px;border-radius:6px;background:var(--field);border:1px solid var(--bd);font-size:11px;">
                                <option value="user" ${u.role === 'user' ? 'selected' : ''}>کاربر</option>
                                <option value="author" ${u.role === 'author' ? 'selected' : ''}>نویسنده</option>
                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>مدیر</option>
                            </select>
                            ${u.id !== user.id ? `
                                <button class="btn-ghost small" onclick="Nova.deleteUser('${u.id}')" style="color:var(--nova-red);">🗑</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- گزارش‌ها -->
        <div class="side-tab-content" data-tab-content="reports">
            <div class="panel-card">
                <h4>گزارش‌ها (${faNum(reports.length)})</h4>
                ${reports.length === 0 ? '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:20px;">گزارشی نیست</p>' :
                    reports.map(r => `
                        <div class="panel-row">
                            <div>
                                <div style="font-size:13px;font-weight:700;">${escapeHtml(r.reason || 'بدون دلیل')}</div>
                                <div style="font-size:11px;color:var(--tx-mute);">${timeAgo(r.ts)}</div>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        </div>

        <!-- تنظیمات -->
        <div class="side-tab-content" data-tab-content="settings">
            <div class="panel-card">
                <h4>تنظیمات سایت</h4>
                <div class="panel-row">
                    <span>رنگ تاکیدی</span>
                    <input type="color" id="adminAccent" value="#7c3aed" style="width:60px;height:32px;border:none;border-radius:8px;cursor:pointer;">
                </div>
                <div class="panel-row">
                    <span>سطح گرافیکی</span>
                    <select id="adminPerf" style="padding:6px 10px;border-radius:8px;background:var(--field);border:1px solid var(--bd);font-size:12px;">
                        <option value="auto" ${State.perf === 'auto' ? 'selected' : ''}>خودکار</option>
                        <option value="ultra-low">Ultra Low</option>
                        <option value="low">Low</option>
                        <option value="mid">Mid</option>
                        <option value="high">High</option>
                        <option value="ultra">Ultra</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- پشتیبان -->
        <div class="side-tab-content" data-tab-content="backup">
            <div class="panel-card">
                <h4>پشتیبان‌گیری</h4>
                <p style="font-size:12px;color:var(--tx-mute);margin-bottom:12px;">همه پست‌ها، کاربران و تنظیمات</p>
                <button class="btn-primary full" id="exportBtn" style="margin-bottom:10px;">
                    📥 خروجی JSON
                </button>
                <button class="btn-ghost full" id="importBtn" style="margin-bottom:10px;">
                    📤 بازیابی
                </button>
                <input type="file" id="importFile" accept=".json" hidden>
            </div>
        </div>
    `;

    /* Event Listeners */
    $('#adminAccent')?.addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--accent', e.target.value);
    });

    $('#adminPerf')?.addEventListener('change', (e) => {
        State.perf = e.target.value;
        store.set('nova.perf', State.perf);
        applyPerf(State.perf === 'auto' ? detectPerf() : State.perf);
    });

    $('#exportBtn')?.addEventListener('click', exportData);
    $('#importBtn')?.addEventListener('click', () => $('#importFile')?.click());
    $('#importFile')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importData(file);
    });
}

function changeRole(userId, role) {
    const users = DB.getUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return;
    u.role = role;
    DB.setUsers(users);
    toast(`✅ نقش ${u.displayName} به ${role} تغییر یافت`);
}

function deleteUser(userId) {
    if (!confirm('مطمئنی؟')) return;
    const users = DB.getUsers();
    const filtered = users.filter(u => u.id !== userId);
    DB.setUsers(filtered);
    renderAdminPanel();
    toast('کاربر حذف شد');
}

function exportData() {
    const data = {
        users: DB.getUsers(),
        posts: DB.getPosts(),
        settings: DB.getSettings(),
        exportedAt: Date.now(),
        version: '2.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ پشتیبان دانلود شد');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.users)   DB.setUsers(data.users);
            if (data.posts)   DB.setPosts(data.posts);
            if (data.settings) DB.setSettings(data.settings);
            toast('✅ بازیابی شد');
            renderAdminPanel();
            renderPosts();
            updateStats();
        } catch (err) {
            toast('❌ فایل نامعتبر');
        }
    };
    reader.readAsText(file);
}

/* ═══════════════════════════════════
   ۲۴. پنل نویسنده
═══════════════════════════════════ */
function renderAuthorPanel() {
    const body = $('#authorPanelBody');
    const user = State.currentUser;
    if (!body || !user) return;

    const myPosts = DB.getPosts().filter(p => p.authorId === user.id);
    const drafts = myPosts.filter(p => p.status === 'draft');
    const published = myPosts.filter(p => p.status === 'published');

    body.innerHTML = `
        <div class="side-tab-content active" data-tab-content="dashboard">
            <div class="panel-stats-grid">
                <div class="panel-stat-box">
                    <strong>${faNum(published.length)}</strong>
                    <span>منتشرشده</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(drafts.length)}</strong>
                    <span>پیش‌نویس</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(myPosts.reduce((s, p) => s + (p.views || 0), 0))}</strong>
                    <span>بازدید</span>
                </div>
                <div class="panel-stat-box">
                    <strong>${faNum(myPosts.reduce((s, p) => s + (p.comments?.length || 0), 0))}</strong>
                    <span>کامنت</span>
                </div>
            </div>

            <div class="panel-card">
                <button class="btn-primary full" onclick="Nova.newPost()">
                    ✍️ پست جدید
                </button>
            </div>
        </div>

        <div class="side-tab-content" data-tab-content="myposts">
            <div class="panel-card">
                <h4>پست‌های منتشرشده (${faNum(published.length)})</h4>
                ${published.length === 0 ? '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:20px;">هنوز پستی نداری</p>' :
                    published.map(p => `
                        <div class="panel-row">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:right;">${escapeHtml(p.title)}</div>
                                <div style="font-size:11px;color:var(--tx-mute);">${faNum(p.views || 0)} بازدید · ${timeAgo(p.createdAt)}</div>
                            </div>
                            <button class="btn-ghost small" onclick="Nova.editPost('${p.id}')">✎</button>
                        </div>
                    `).join('')
                }
            </div>
        </div>

        <div class="side-tab-content" data-tab-content="drafts">
            <div class="panel-card">
                <h4>پیش‌نویس‌ها (${faNum(drafts.length)})</h4>
                ${drafts.length === 0 ? '<p style="font-size:13px;color:var(--tx-mute);text-align:center;padding:20px;">پیش‌نویسی نداری</p>' :
                    drafts.map(p => `
                        <div class="panel-row">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:13px;font-weight:700;direction:ltr;text-align:right;">${escapeHtml(p.title)}</div>
                                <div style="font-size:11px;color:var(--tx-mute);">${timeAgo(p.updatedAt)}</div>
                            </div>
                            <button class="btn-ghost small" onclick="Nova.editPost('${p.id}')">✎</button>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
}

/* ═══════════════════════════════════
   ۲۵. ادیتور پست
═══════════════════════════════════ */
function openEditor(postId = null) {
    const user = State.currentUser;
    if (!user || (user.role !== 'author' && user.role !== 'admin')) {
        toast('❌ اجازه‌ی دسترسی نداری');
        return;
    }

    State.editorPostId = postId;

    const titleEl = $('#editorTitle');
    const contentEl = $('#editorContent');
    const titleText = $('#editorTitleText');

    if (postId) {
        const post = DB.getPosts().find(p => p.id === postId);
        if (post) {
            titleEl.value = post.title;
            contentEl.innerHTML = post.content;
            $('#editorCategory').value = post.category;
            $('#editorPlatform').value = post.platform;
            $('#editorTags').value = (post.tags || []).join(', ');
            $('#editorCover').value = post.cover || '';
            $('#editorExcerpt').value = post.excerpt || '';
            $('#editorScore').value = post.score || '';
            $('#editorStatus').value = post.status;
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
        $('#editorStatus').value = 'published';
        titleText.textContent = 'پست جدید';
    }

    openModal('editorOverlay');
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
    const status = $('#editorStatus').value;

    if (!title) {
        toast('❌ عنوان پست لازمه');
        return;
    }

    const result = createPost({
        id: State.editorPostId,
        title, content, category, platform, tags,
        cover, excerpt, score, status
    });

    if (result.ok) {
        toast(State.editorPostId ? '✅ پست ویرایش شد' : '✅ پست منتشر شد');
        closeModal('editorOverlay');
        renderPosts();
        updateStats();
        if (State.activePanel === 'admin') renderAdminPanel();
        if (State.activePanel === 'author') renderAuthorPanel();
    } else {
        toast('❌ ' + result.error);
    }
}

function initEditor() {
    /* Toolbar */
    $$('.editor-toolbar button[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val || null;
            document.execCommand(cmd, false, val);
            $('#editorContent')?.focus();
        });
    });

    /* Toolbar: تصویر */
    $('#toolbarImage')?.addEventListener('click', () => {
        const url = prompt('آدرس تصویر:');
        if (url) document.execCommand('insertImage', false, url);
    });

    /* Toolbar: لینک */
    $('#toolbarLink')?.addEventListener('click', () => {
        const url = prompt('آدرس لینک:');
        if (url) document.execCommand('createLink', false, url);
    });

    /* Toolbar: کد */
    $('#toolbarCode')?.addEventListener('click', () => {
        const text = prompt('کد:');
        if (text) {
            document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`);
        }
    });

    /* ذخیره */
    $('#editorSave')?.addEventListener('click', saveEditor);

    /* پیش‌نمایش */
    $('#editorPreview')?.addEventListener('click', () => {
        const title = $('#editorTitle').value;
        const content = $('#editorContent').innerHTML;
        if (!title) { toast('عنوان خالیه'); return; }

        const overlay = $('#postOverlay');
        const box = $('#postContent');
        box.innerHTML = `
            <div class="post-header">
                <h1>${escapeHtml(title)}</h1>
                <div class="post-meta">
                    <span>پیش‌نمایش</span>
                </div>
            </div>
            <div class="post-body">${content}</div>
        `;
        overlay.hidden = false;
        requestAnimationFrame(() => overlay.classList.add('on'));
    });

    /* دکمه ساخت پست */
    $('#createPostBtn')?.addEventListener('click', () => openEditor());
    $('#emptyCreateBtn')?.addEventListener('click', () => openEditor());
}

/* ═══════════════════════════════════
   ۲۶. جستجو
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
            results.innerHTML = '<span class="search-hint">شروع به تایپ کن تا نتایج را ببینی...</span>';
            return;
        }

        const posts = DB.getPosts().filter(p =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.content || '').toLowerCase().includes(q)
        ).slice(0, 8);

        const users = DB.getUsers().filter(u =>
            u.username.toLowerCase().includes(q) ||
            u.displayName.toLowerCase().includes(q)
        ).slice(0, 5);

        if (posts.length === 0 && users.length === 0) {
            results.innerHTML = '<span class="search-hint">نتیجه‌ای پیدا نشد</span>';
            return;
        }

        let html = '';

        if (posts.length) {
            html += '<div style="font-size:11px;font-weight:800;color:var(--tx-mute);letter-spacing:1px;margin:12px 8px 6px;">پست‌ها</div>';
            html += posts.map(p => `
                <div class="search-result-item" onclick="Nova.openPost('${p.id}'); Nova.closeSearch();">
                    <div class="search-result-icon">📰</div>
                    <div class="search-result-info">
                        <strong>${escapeHtml(p.title)}</strong>
                        <small>${faNum(p.views || 0)} بازدید</small>
                    </div>
                </div>
            `).join('');
        }

        if (users.length) {
            html += '<div style="font-size:11px;font-weight:800;color:var(--tx-mute);letter-spacing:1px;margin:12px 8px 6px;">کاربران</div>';
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

        results.innerHTML = html;
    });
}

function closeSearch() {
    closeModal('searchOverlay');
}

/* ═══════════════════════════════════
   ۲۷. منوی موبایل
═══════════════════════════════════ */
function initMobileMenu() {
    const menu = $('#mobileMenu');
    const openBtn = $('#menuBtn');
    const closeBtn = $('#mobileMenuClose');
    const backdrop = $('#mobileMenuBackdrop');

    function open() {
        if (!menu) return;
        menu.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function close() {
        if (!menu) return;
        menu.hidden = true;
        document.body.style.overflow = '';
    }

    openBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);

    $$('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
            close();
        });
    });
}

function closeMobileMenu() {
    const menu = $('#mobileMenu');
    if (menu) menu.hidden = true;
    document.body.style.overflow = '';
}

/* ═══════════════════════════════════
   ۲۸. فیلتر اخبار
═══════════════════════════════════ */
function initFilter() {
    $$('#filterTabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('#filterTabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            State.currentFilter = tab.dataset.cat || 'all';
            renderPosts();
        });
    });
}

/* ═══════════════════════════════════
   ۲۹. لینک‌های نرم
═══════════════════════════════════ */
function initSmoothScroll() {
    $$('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#' || href.length < 2) return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            const top = target.getBoundingClientRect().top + window.scrollY - 90;
            window.scrollTo({ top, behavior: 'smooth' });
        });
    });
}

/* ═══════════════════════════════════
   ۳۰. انیمیشن‌های GSAP + پارالاکس
═══════════════════════════════════ */
function initAnimations() {
    if (!window.gsap) {
        console.warn('GSAP بارگذاری نشد');
        return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const perf = document.documentElement.dataset.perf || 'high';
    const isLow = perf === 'ultra-low' || perf === 'low';

    /* هیرو تیتر */
    gsap.from('.hero-title .line', {
        opacity: 0, y: 60, rotateX: -40,
        duration: 1.1, stagger: 0.15,
        ease: 'power4.out', delay: 0.3
    });

    /* هیرو کارت */
    gsap.from('.hero-card', {
        opacity: 0, y: 40, scale: 0.97,
        duration: 1, ease: 'power3.out', delay: 0.2
    });

    /* آمار */
    gsap.from('.stat-card', {
        opacity: 0, y: 30, stagger: 0.1,
        duration: .8, ease: 'power3.out', delay: 0.8
    });

    /* ترندینگ */
    gsap.from('.trending-bar', {
        opacity: 0, y: 20, duration: .8, delay: 1.2
    });

    /* کارت‌های خبر (بدون blur در low) */
    if (!isLow) {
        gsap.utils.toArray('.news-card').forEach((card, i) => {
            gsap.from(card, {
                opacity: 0, y: 40,
                filter: 'blur(8px)',
                duration: .9, delay: (i % 2) * .1,
                scrollTrigger: { trigger: card, start: 'top 88%' }
            });
        });
    }

    /* سایدبار */
    if (!isLow) {
        gsap.utils.toArray('.side-col > *').forEach((el, i) => {
            gsap.from(el, {
                opacity: 0, x: 30,
                duration: .8, delay: i * .12,
                scrollTrigger: { trigger: el, start: 'top 90%' }
            });
        });
    }

    /* Section titles */
    gsap.utils.toArray('.section-title').forEach(el => {
        gsap.from(el, {
            opacity: 0, x: -30, duration: .8,
            scrollTrigger: { trigger: el, start: 'top 88%' }
        });
    });

    /* CTA */
    gsap.from('.cta-card', {
        opacity: 0, y: 40, scale: 0.96,
        duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.cta-card', start: 'top 85%' }
    });

    /* فوتر */
    gsap.from('.footer-col', {
        opacity: 0, y: 30, stagger: .1,
        duration: .7,
        scrollTrigger: { trigger: '.footer', start: 'top 90%' }
    });

    /* پارالاکس Blob ها */
    if (!isLow) {
        gsap.to('.blob-1', { y: 200, x: -100, ease: 'none',
            scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 2 } });
        gsap.to('.blob-2', { y: -200, x: 100, ease: 'none',
            scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 2 } });
        gsap.to('.blob-3', { y: 150, x: 80, ease: 'none',
            scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 3 } });
        gsap.to('.blob-4', { y: -150, x: -80, ease: 'none',
            scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 3 } });
        gsap.to('.blob-5', { y: 120, x: -60, ease: 'none',
            scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 4 } });
    }

    /* پارالاکس هیرو */
    if (!isLow && perf === 'high' || perf === 'ultra') {
        gsap.to('.hero-card', {
            y: 60, opacity: 0.4, ease: 'none',
            scrollTrigger: {
                trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1
            }
        });
    }

    /* Mouse Parallax (فقط دسکتاپ و High) */
    if (perf === 'high' || perf === 'ultra') {
        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / innerWidth - 0.5) * 2;
            mouseY = (e.clientY / innerHeight - 0.5) * 2;

            gsap.to('.blob-1', { x: mouseX * 30, y: mouseY * 20, duration: 1.2, ease: 'power2.out', overwrite: 'auto' });
            gsap.to('.blob-2', { x: mouseX * -30, y: mouseY * -20, duration: 1.2, ease: 'power2.out', overwrite: 'auto' });
            gsap.to('.blob-3', { x: mouseX * 20, y: mouseY * -20, duration: 1.4, ease: 'power2.out', overwrite: 'auto' });
        });
    }

    /* Magnetic Buttons */
    if (perf === 'high' || perf === 'ultra') {
        $$('.btn-primary, .icon-btn').forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                gsap.to(btn, { x: x * 0.15, y: y * 0.15, duration: 0.4, ease: 'power2.out' });
            });
            btn.addEventListener('mouseleave', () => {
                gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
            });
        });
    }

    /* Tilt روی کارت‌ها */
    if (perf === 'ultra') {
        $$('.review-card, .news-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                gsap.to(card, {
                    rotateY: x * 6, rotateX: -y * 6,
                    transformPerspective: 800,
                    duration: 0.4
                });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.7 });
            });
        });
    }

    window.addEventListener('resize', () => ScrollTrigger.refresh());

    console.log('%c✨ GSAP animations loaded', 'color:#7c3aed;font-weight:bold');
}

/* ═══════════════════════════════════
   ۳۱. مکث انیمیشن‌ها در تب مخفی
═══════════════════════════════════ */
function initVisibilityPause() {
    document.addEventListener('visibilitychange', () => {
        const items = $$('.blob, .heart, .live-dot, .hero-shine, .newsletter-icon, .nova-core, .nova-ring');
        items.forEach(el => {
            el.style.animationPlayState = document.hidden ? 'paused' : 'running';
        });
    });
}

/* ═══════════════════════════════════
   ۳۲. اندازه فونت
═══════════════════════════════════ */
function applyFontSize(val) {
    State.fontSize = val;
    document.documentElement.style.setProperty('--font-scale', val / 100);
    store.set('nova.fontSize', val);
}

/* ═══════════════════════════════════
   ۳۳. API عمومی (برای onclick)
═══════════════════════════════════ */
window.Nova = {
    openPost,
    editPost: openEditor,
    deletePost: (id) => {
        if (confirm('مطمئنی؟')) {
            deletePost(id);
            renderPosts();
            if (State.activePanel === 'admin') renderAdminPanel();
            if (State.activePanel === 'author') renderAuthorPanel();
            toast('حذف شد');
        }
    },
    newPost: () => openEditor(),
    startChat,
    sendFriendRequest,
    changeRole,
    deleteUser,
    closeSearch
};

/* ═══════════════════════════════════
   ۳۴. Boot
═══════════════════════════════════ */
function boot() {
    console.log('%c✦ Nova Game', 'color:#7c3aed;font-weight:900;font-size:18px;letter-spacing:2px');

    /* تم */
    applyTheme(State.theme);

    /* عملکرد */
    const tier = State.perf === 'auto' ? detectPerf() : State.perf;
    applyPerf(tier);

    /* فونت */
    applyFontSize(State.fontSize);

    /* Preloader */
    initPreloader();

    /* ستاره‌ها */
    generateStars();

    /* کاربر */
    State.currentUser = getCurrentUser();
    updateAuthUI();

    /* سرویس‌ها */
    initScrollUI();
    initAuth();
    initEditor();
    initSearch();
    initMobileMenu();
    initFilter();
    initSmoothScroll();
    initVisibilityPause();

    /* رندر */
    renderPosts();
    updateStats();

    /* دکمه‌های پنل‌های ویژه */
    document.addEventListener('click', (e) => {
        const user = State.currentUser;

        /* باز کردن پنل مدیر با دکمه مخفی */
        const adminTrigger = e.target.closest('[data-open-panel="admin"]');
        if (adminTrigger && user?.role === 'admin') openPanel('admin');

        /* باز کردن پنل نویسنده */
        const authorTrigger = e.target.closest('[data-open-panel="author"]');
        if (authorTrigger && (user?.role === 'author' || user?.role === 'admin')) openPanel('author');

        /* باز کردن پنل کاربر */
        const userTrigger = e.target.closest('[data-open-panel="user"]');
        if (userTrigger) openPanel('user');
    });

    /* GSAP بعد از DOMContentLoaded */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnimations);
    } else {
        initAnimations();
    }

    /* میانبرها */
    console.log('%cمیانبر: Ctrl+K جستجو · Esc بستن', 'color:#a855f7;font-size:11px');
    console.log('%c© ۱۴۰۴ آریا عزیزی', 'color:#d1006b;font-size:11px');
}

/* اجرا */
boot();
