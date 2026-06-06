/* ── Assets view ─────────────────────────────────────────── */

async function renderAssets(container) {
  const db = getDB();
  const family = await getCurrentFamily();

  const [
    { data: assets },
    { data: categories },
    { data: custody }
  ] = await Promise.all([
    db.from('assets')
      .select('*, categories(name, icon), families!owner_family_id(name, color), asset_custody(family_id, returned_at, families(name, color))')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    db.from('categories').select('*').order('name'),
    db.from('asset_custody').select('asset_id, family_id, returned_at, families(name, color)').is('returned_at', null)
  ]);

  // Build custody map
  const custodyMap = {};
  (custody || []).forEach(c => { custodyMap[c.asset_id] = c; });

  let filterCat = 'all';

  function renderGrid() {
    const filtered = filterCat === 'all'
      ? assets
      : assets?.filter(a => a.category_id === filterCat);

    return (filtered && filtered.length > 0)
      ? `<div class="grid-3">${filtered.map(a => assetCard(a, custodyMap[a.id])).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🎮</div><h3>No assets yet</h3><p>Be the first to add something to share!</p></div>`;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2>🎮 Shared Assets</h2>
        <div class="page-sub">Browse and book items available to all families</div>
      </div>
      <button class="btn btn-primary" id="add-asset-btn">+ Add Asset</button>
    </div>

    <!-- Category filter -->
    <div class="tabs" id="cat-tabs">
      <button class="tab-btn active" data-cat="all">All</button>
      ${(categories || []).map(c => `<button class="tab-btn" data-cat="${c.id}">${c.icon} ${c.name}</button>`).join('')}
    </div>

    <div id="assets-grid">${renderGrid()}</div>
  `;

  // Category filter
  container.querySelector('#cat-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterCat = btn.dataset.cat;
    container.querySelector('#assets-grid').innerHTML = renderGrid();
    attachAssetCardHandlers();
  });

  // Add asset button
  container.querySelector('#add-asset-btn').addEventListener('click', () => showAddAssetModal(categories, family, () => renderAssets(container)));

  attachAssetCardHandlers();

  function attachAssetCardHandlers() {
    container.querySelectorAll('.asset-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const asset = assets?.find(a => a.id === id);
        if (asset) showAssetDetail(asset, custodyMap[asset.id], family, () => renderAssets(container));
      });
    });
  }
}

function assetCard(asset, custody) {
  const icon = asset.categories?.icon || '📦';
  const hasIt = custody ? custody.families?.name : null;
  const statusBadge = hasIt
    ? `<span class="badge badge-active">With ${hasIt}</span>`
    : `<span class="badge badge-returned">Available</span>`;

  return `
    <div class="asset-card" data-id="${asset.id}">
      <div class="asset-img">
        ${asset.photo_url ? `<img src="${asset.photo_url}" alt="${asset.name}" />` : icon}
      </div>
      <div class="asset-body">
        <div class="asset-name">${asset.name}</div>
        <div class="asset-meta">
          <span>${icon} ${asset.categories?.name || 'Other'}</span>
          ${asset.families ? `<span>Owned by ${asset.families.name}</span>` : ''}
          <span>Max ${asset.max_booking_days} days</span>
        </div>
        <div class="asset-status">
          ${statusBadge}
          <button class="btn btn-primary btn-sm">Book →</button>
        </div>
      </div>
    </div>`;
}

function showAddAssetModal(categories, family, onSuccess) {
  const db = getDB();
  openModal(`
    <h2>➕ Add Shared Asset</h2>
    <form id="add-asset-form">
      <div class="form-group">
        <label>Asset Name</label>
        <input type="text" id="asset-name" placeholder="Nintendo Switch" required />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="asset-desc" rows="2" placeholder="Brief description…"></textarea>
      </div>
      <div class="form-group">
        <label>Category</label>
        <select id="asset-cat">
          ${(categories || []).map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Photo URL (optional)</label>
        <input type="url" id="asset-photo" placeholder="https://…" />
      </div>
      <div class="form-group">
        <label>Max Booking Days</label>
        <input type="number" id="asset-maxdays" value="7" min="1" max="90" />
      </div>
      <div id="asset-error" class="form-error hidden"></div>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Asset</button>
      </div>
    </form>
  `);

  document.getElementById('add-asset-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('asset-error');
    errEl.classList.add('hidden');
    const profile = await getCurrentProfile();
    try {
      const { error } = await db.from('assets').insert({
        name:            document.getElementById('asset-name').value.trim(),
        description:     document.getElementById('asset-desc').value.trim(),
        category_id:     document.getElementById('asset-cat').value,
        photo_url:       document.getElementById('asset-photo').value.trim() || null,
        max_booking_days: parseInt(document.getElementById('asset-maxdays').value),
        owner_family_id: family?.id,
        created_by:      (await getCurrentUser())?.id,
      });
      if (error) throw error;
      closeModal();
      showToast('Asset added!', 'success');

      // Notify all families
      if (family) {
        await db.from('notifications').insert({
          family_id: null,
          type: 'new_asset',
          title: 'New asset available!',
          body: `${family.name} added a new item to share: ${document.getElementById('asset-name').value.trim()}`,
          link: '#assets'
        });
      }

      onSuccess();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

function showAssetDetail(asset, custody, myFamily, onSuccess) {
  const db = getDB();
  const icon = asset.categories?.icon || '📦';
  const hasIt = custody ? custody.families?.name : null;
  const today = new Date().toISOString().split('T')[0];
  const weekLater = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];

  openModal(`
    <div style="text-align:center;margin-bottom:1.25rem">
      <div style="font-size:4rem;margin-bottom:0.5rem">${asset.photo_url ? `<img src="${asset.photo_url}" style="width:120px;height:120px;object-fit:cover;border-radius:12px" />` : icon}</div>
      <h2>${asset.name}</h2>
      <div style="color:var(--text-2);font-size:0.9rem;margin-top:0.25rem">${icon} ${asset.categories?.name || ''} · Max ${asset.max_booking_days} days</div>
      ${hasIt ? `<div style="margin-top:0.5rem"><span class="badge badge-active">Currently with ${hasIt}</span></div>` : `<span class="badge badge-returned" style="margin-top:0.5rem;display:inline-block">Available</span>`}
    </div>
    ${asset.description ? `<p style="color:var(--text-2);margin-bottom:1.25rem;font-size:0.9rem">${asset.description}</p>` : ''}

    <h3 style="font-size:1rem;margin-bottom:0.75rem">📅 Book This Asset</h3>
    <form id="book-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="form-group">
          <label>Start Date</label>
          <input type="date" id="book-start" value="${today}" min="${today}" required />
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="date" id="book-end" value="${weekLater}" min="${today}" required />
        </div>
      </div>
      <div class="form-group">
        <label>Notes (optional)</label>
        <textarea id="book-notes" rows="2" placeholder="Any notes for the handover…"></textarea>
      </div>
      <div id="book-error" class="form-error hidden"></div>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:0.75rem">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Confirm Booking</button>
      </div>
    </form>
  `);

  document.getElementById('book-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('book-error');
    errEl.classList.add('hidden');
    const start = document.getElementById('book-start').value;
    const end   = document.getElementById('book-end').value;

    if (end < start) { errEl.textContent = 'End date must be after start date.'; errEl.classList.remove('hidden'); return; }
    const days = (new Date(end) - new Date(start)) / 86400000 + 1;
    if (days > asset.max_booking_days) { errEl.textContent = `Max booking is ${asset.max_booking_days} days.`; errEl.classList.remove('hidden'); return; }

    try {
      // Check for overlaps
      const { data: overlapping } = await db.from('bookings')
        .select('id, families(name)')
        .eq('asset_id', asset.id)
        .not('status', 'in', '("cancelled","returned")')
        .lte('start_date', end)
        .gte('end_date', start);

      if (overlapping && overlapping.length > 0) {
        errEl.textContent = `Dates clash with a booking by ${overlapping[0].families?.name || 'another family'}.`;
        errEl.classList.remove('hidden');
        return;
      }

      const { error } = await db.from('bookings').insert({
        asset_id:  asset.id,
        family_id: myFamily?.id,
        booked_by: (await getCurrentUser())?.id,
        start_date: start,
        end_date:   end,
        notes:      document.getElementById('book-notes').value.trim() || null,
      });
      if (error) throw error;
      closeModal();
      showToast('Booking confirmed! 🎉', 'success');
      onSuccess();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}
