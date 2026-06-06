/* ── Family view ─────────────────────────────────────────── */

async function renderFamily(container) {
  const db = getDB();
  const family  = await getCurrentFamily();
  const profile = await getCurrentProfile();
  const user    = await getCurrentUser();

  if (!family) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👨‍👩‍👧</div>
        <h3>You're not in a family yet</h3>
        <p>Sign out and create an account to set up your family.</p>
      </div>`;
    return;
  }

  const [
    { data: members },
    { data: allFamilies },
    { data: familyBookings }
  ] = await Promise.all([
    db.from('profiles').select('*, families(name)').eq('family_id', family.id),
    db.from('families').select('id, name, color, avatar_url'),
    db.from('bookings')
      .select('*, assets(name, categories(icon))')
      .eq('family_id', family.id)
      .order('start_date', { ascending: false })
      .limit(10)
  ]);

  const isAdmin = profile?.role === 'admin';

  container.innerHTML = `
    <!-- Family hero card -->
    <div class="family-profile-card">
      <div class="family-hero" id="family-hero" style="background:linear-gradient(135deg, ${family.color}, ${darken(family.color)})">
        ${family.banner_url ? `<img class="family-hero-img" src="${family.banner_url}" />` : ''}
      </div>
      <div class="family-profile-body">
        <div class="family-big-avatar" id="family-avatar-display" style="background:${family.color}">
          ${family.avatar_url ? `<img src="${family.avatar_url}" style="width:100%;height:100%;object-fit:cover" />` : family.name[0].toUpperCase()}
        </div>
        <div class="family-big-name">${family.name}</div>
        <div class="family-big-sub">${members?.length || 0} member${members?.length !== 1 ? 's' : ''}</div>
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="margin-top:0.75rem" id="edit-family-btn">✏️ Edit Family</button>` : ''}
      </div>
    </div>

    <div class="grid-2">
      <!-- Members -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">👥 Family Members</div>
        </div>
        ${(members || []).map(m => `
          <div class="member-row">
            <div class="member-avatar">${(m.display_name || m.id)[0].toUpperCase()}</div>
            <div class="member-name">${m.display_name || 'Unnamed'} ${m.id === user?.id ? '<span style="font-size:0.75rem;color:var(--accent)">(you)</span>' : ''}</div>
            <div class="member-role">${m.role}</div>
          </div>`).join('')}
      </div>

      <!-- My profile -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">👤 My Profile</div>
        </div>
        <form id="profile-form">
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" id="p-name" value="${profile?.display_name || ''}" placeholder="Your name" />
          </div>
          <div id="profile-msg" class="hidden" style="font-size:0.85rem;margin-bottom:0.75rem;color:var(--green)"></div>
          <button type="submit" class="btn btn-primary btn-sm">Save Profile</button>
        </form>
      </div>

      <!-- All families panel -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏡 All Families</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          ${(allFamilies || []).map(f => `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <div style="width:32px;height:32px;border-radius:8px;background:${f.color};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:0.9rem;flex-shrink:0;overflow:hidden">
                ${f.avatar_url ? `<img src="${f.avatar_url}" style="width:100%;height:100%;object-fit:cover" />` : f.name[0].toUpperCase()}
              </div>
              <div style="flex:1;font-size:0.9rem;font-weight:${f.id === family.id ? '700' : '500'}">${f.name} ${f.id === family.id ? '← you' : ''}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Family booking history -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 Our Booking History</div>
        </div>
        ${(familyBookings || []).length > 0
          ? `<div style="display:flex;flex-direction:column;gap:0.4rem">
               ${familyBookings.map(b => `
                 <div style="display:flex;align-items:center;gap:0.75rem;padding:0.45rem 0;border-bottom:1px solid var(--border);font-size:0.88rem">
                   <span>${b.assets?.categories?.icon || '📦'}</span>
                   <span style="flex:1">${b.assets?.name || '—'}</span>
                   <span style="color:var(--text-2)">${shortDateF(b.start_date)}</span>
                   <span class="badge badge-${b.status}">${b.status}</span>
                 </div>`).join('')}
             </div>`
          : `<div class="empty-state" style="padding:1rem"><p>No bookings yet</p></div>`
        }
      </div>
    </div>
  `;

  // Profile form
  container.querySelector('#profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('p-name').value.trim();
    const { error } = await db.from('profiles').update({ display_name: name }).eq('id', user.id);
    const msg = document.getElementById('profile-msg');
    if (error) { msg.style.color = 'var(--red)'; msg.textContent = error.message; }
    else        { msg.style.color = 'var(--green)'; msg.textContent = 'Saved!'; }
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
    // Refresh nav display name
    document.getElementById('nav-user-name').textContent = name;
    _currentProfile.display_name = name;
  });

  // Edit family (admin only)
  if (isAdmin) {
    container.querySelector('#edit-family-btn').addEventListener('click', () => showEditFamilyModal(family, () => renderFamily(container)));
  }
}

function showEditFamilyModal(family, onSuccess) {
  const db = getDB();
  openModal(`
    <h2>✏️ Edit Family</h2>
    <form id="edit-family-form">
      <div class="form-group">
        <label>Family Name</label>
        <input type="text" id="ef-name" value="${family.name}" required />
      </div>
      <div class="form-group">
        <label>Family Colour</label>
        <div class="color-presets" id="ef-colors">
          ${['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'].map(c =>
            `<button type="button" class="color-swatch${family.color === c ? ' active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          <input type="color" id="ef-color-pick" value="${family.color}" title="Custom colour" />
        </div>
      </div>
      <div class="form-group">
        <label>Avatar URL (optional)</label>
        <input type="url" id="ef-avatar" value="${family.avatar_url || ''}" placeholder="https://…" />
      </div>
      <div class="form-group">
        <label>Banner URL (optional)</label>
        <input type="url" id="ef-banner" value="${family.banner_url || ''}" placeholder="https://…" />
      </div>
      <div id="ef-error" class="form-error hidden"></div>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `);

  let selectedColor = family.color;
  document.querySelectorAll('#ef-colors .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#ef-colors .color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      selectedColor = sw.dataset.color;
      document.getElementById('ef-color-pick').value = selectedColor;
    });
  });
  document.getElementById('ef-color-pick').addEventListener('input', e => { selectedColor = e.target.value; });

  document.getElementById('edit-family-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('ef-error');
    errEl.classList.add('hidden');
    try {
      const { error } = await db.from('families').update({
        name:       document.getElementById('ef-name').value.trim(),
        color:      selectedColor,
        avatar_url: document.getElementById('ef-avatar').value.trim() || null,
        banner_url: document.getElementById('ef-banner').value.trim() || null,
      }).eq('id', family.id);
      if (error) throw error;
      // Update local state
      _currentFamily.name   = document.getElementById('ef-name').value.trim();
      _currentFamily.color  = selectedColor;
      applyFamilyTheme(selectedColor);
      updateNavFamily();
      closeModal();
      showToast('Family updated!', 'success');
      onSuccess();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

function darken(hex) {
  // Simple darkening for gradient
  const r = Math.max(0, parseInt(hex.slice(1,3),16) - 60);
  const g = Math.max(0, parseInt(hex.slice(3,5),16) - 60);
  const b = Math.max(0, parseInt(hex.slice(5,7),16) - 60);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function shortDateF(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
}
