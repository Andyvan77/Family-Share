/* ── FamilyShare — Main App ──────────────────────────────── */

// ── Global helpers ────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// ── Setup screen ──────────────────────────────────────────

function showSetup() {
  document.getElementById('setup-overlay').classList.remove('hidden');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
}

document.getElementById('cfg-save').addEventListener('click', () => {
  const url = document.getElementById('cfg-url').value.trim();
  const key = document.getElementById('cfg-key').value.trim();
  if (!url || !key) return showToast('Please fill in both fields', 'error');
  saveConfig(url, key);
  location.reload();
});

// ── Auth screen ───────────────────────────────────────────

function showAuthScreen() {
  document.getElementById('setup-overlay').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
    if (which === 'register') loadFamiliesForRegister();
  });
});

// Family/join toggle
document.querySelectorAll('[name="family-action"]').forEach(r => {
  r.addEventListener('change', () => {
    const isCreate = r.value === 'create';
    document.getElementById('create-family-fields').classList.toggle('hidden', !isCreate);
    document.getElementById('join-family-fields').classList.toggle('hidden', isCreate);
  });
});

// Colour swatches on register
let regColor = '#7c3aed';
document.querySelectorAll('.color-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    regColor = sw.dataset.color;
    document.getElementById('reg-family-color').value = regColor;
  });
});
document.getElementById('reg-family-color').addEventListener('input', e => { regColor = e.target.value; });

async function loadFamiliesForRegister() {
  const db = getDB();
  const { data } = await db.from('families').select('id, name').order('name');
  const sel = document.getElementById('reg-family-select');
  sel.innerHTML = (data || []).map(f => `<option value="${f.id}">${f.name}</option>`).join('') || '<option value="">No families yet</option>';
}

// Login form
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    await signIn(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value
    );
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Sign In';
  }
});

// Register form
document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating account…';

  const action = document.querySelector('[name="family-action"]:checked').value;
  const familyId    = action === 'join' ? document.getElementById('reg-family-select').value : null;
  const newFamilyData = action === 'create' ? {
    name:  document.getElementById('reg-family-name').value.trim() || 'My Family',
    color: regColor
  } : null;

  try {
    await signUp(
      document.getElementById('reg-email').value,
      document.getElementById('reg-password').value,
      document.getElementById('reg-name').value.trim(),
      familyId,
      newFamilyData
    );
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Create Account';
  }
});

// ── Main app ──────────────────────────────────────────────

function updateNavFamily() {
  const family  = _currentFamily;
  const profile = _currentProfile;
  if (!family) return;
  document.getElementById('nav-family-name').textContent  = family.name;
  document.getElementById('nav-user-name').textContent    = profile?.display_name || 'Member';
  const avatarEl = document.getElementById('nav-family-avatar');
  if (family.avatar_url) {
    avatarEl.innerHTML = `<img src="${family.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" />`;
  } else {
    avatarEl.textContent = family.name[0].toUpperCase();
    avatarEl.style.background = family.color;
  }
  applyFamilyTheme(family.color);
}

async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateNavFamily();
  await loadNotifications();
  initRouter();
}

// Sign out
document.getElementById('signout-btn').addEventListener('click', async () => {
  await signOut();
  location.reload();
});

// Mobile sidebar toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('sidebar-close').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
});

// Modal close
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Notifications ─────────────────────────────────────────

async function loadNotifications() {
  const db = getDB();
  const user = _currentUser;
  const family = _currentFamily;
  if (!user) return;

  const { data } = await db.from('notifications')
    .select('*')
    .or(`user_id.eq.${user.id},family_id.eq.${family?.id || '00000000-0000-0000-0000-000000000000'}`)
    .order('created_at', { ascending: false })
    .limit(20);

  const unread = (data || []).filter(n => !n.read);
  const badge  = document.getElementById('notif-badge');
  if (unread.length > 0) {
    badge.textContent = unread.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const list = document.getElementById('notif-list');
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="notif-empty">No notifications</div>';
  } else {
    list.innerHTML = data.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
        <div class="notif-dot" style="${n.read ? 'background:var(--text-3)' : ''}"></div>
        <div class="notif-text">
          <strong>${n.title || 'Notification'}</strong>
          <span>${n.body || ''}</span>
        </div>
      </div>`).join('');
  }

  list.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async () => {
      await db.from('notifications').update({ read: true }).eq('id', item.dataset.id);
      item.classList.remove('unread');
      if (item.dataset.link) navigate(item.dataset.link.replace('#', ''));
      closeNotifDropdown();
      loadNotifications();
    });
  });

  // Subscribe to realtime notifications
  db.channel('notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => loadNotifications())
    .subscribe();
}

document.getElementById('notif-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('notif-dropdown').classList.toggle('hidden');
});
document.addEventListener('click', closeNotifDropdown);
function closeNotifDropdown() {
  document.getElementById('notif-dropdown').classList.add('hidden');
}

document.getElementById('mark-read-btn').addEventListener('click', async e => {
  e.stopPropagation();
  const db = getDB();
  const user = _currentUser;
  if (user) await db.from('notifications').update({ read: true }).eq('user_id', user.id);
  loadNotifications();
});

// ── Boot ──────────────────────────────────────────────────

async function boot() {
  const cfg = getConfig();
  if (!cfg) { showSetup(); return; }

  const db = initDB();
  if (!db) { showSetup(); return; }

  const user = await loadUserContext();
  if (!user) {
    showAuthScreen();
    // Also listen for auth state changes
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') showApp();
    });
    return;
  }

  showApp();
}

boot().catch(err => {
  console.error('Boot error:', err);
  showToast('Failed to start app: ' + err.message, 'error');
});
