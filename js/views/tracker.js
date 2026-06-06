/* ── Tracker view ────────────────────────────────────────── */

async function renderTracker(container) {
  const db = getDB();

  const [
    { data: assets },
    { data: custody },
    { data: upcoming }
  ] = await Promise.all([
    db.from('assets').select('*, categories(name, icon)').eq('is_active', true).order('name'),
    db.from('asset_custody')
      .select('*, assets(name, categories(icon)), families(name, color), bookings(start_date, end_date)')
      .is('returned_at', null),
    db.from('bookings')
      .select('*, assets(name, categories(icon)), families(name, color)')
      .eq('status', 'confirmed')
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date')
      .limit(20)
  ]);

  // Build lookup: asset_id → custody
  const custodyMap = {};
  (custody || []).forEach(c => { custodyMap[c.asset_id] = c; });

  const outCount  = custody?.length ?? 0;
  const homeCount = (assets?.length ?? 0) - outCount;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2>📍 Asset Tracker</h2>
        <div class="page-sub">See where every shared item is right now</div>
      </div>
    </div>

    <!-- Summary strip -->
    <div class="grid-4" style="margin-bottom:1.5rem">
      ${trackerStat('🏠', homeCount, 'Items Home')}
      ${trackerStat('🚚', outCount, 'Items Out')}
      ${trackerStat('⏰', upcoming?.length ?? 0, 'Upcoming Pickups')}
      ${trackerStat('🎮', assets?.length ?? 0, 'Total Assets')}
    </div>

    <div class="grid-2">
      <!-- Live custody list -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📍 Where Everything Is</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.6rem">
          ${(assets || []).map(a => {
            const c = custodyMap[a.id];
            const icon = a.categories?.icon || '📦';
            return `
              <div class="custody-row">
                <div style="font-size:1.2rem;width:24px;text-align:center">${icon}</div>
                <div class="custody-asset">${a.name}</div>
                ${c ? `
                  <div class="custody-who">
                    <div class="custody-dot"></div>
                    <span style="font-weight:600;color:${c.families?.color || 'var(--accent)'}">${c.families?.name || '—'}</span>
                    <span style="font-size:0.78rem;color:var(--text-2)">since ${shortDate(c.collected_at)}</span>
                  </div>` : `
                  <div class="custody-who">
                    <div class="custody-dot none"></div>
                    <span style="color:var(--text-3)">Home / Available</span>
                  </div>`}
              </div>`;
          }).join('') || '<div class="empty-state" style="padding:1rem"><p>No assets loaded yet</p></div>'}
        </div>
      </div>

      <!-- Upcoming pickups -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">⏰ Upcoming Pickups</div>
        </div>
        ${upcoming && upcoming.length > 0
          ? `<div style="display:flex;flex-direction:column;gap:0.5rem">
               ${upcoming.map(b => `
                 <div class="custody-row">
                   <div style="font-size:1.1rem">${b.assets?.categories?.icon || '📦'}</div>
                   <div style="flex:1">
                     <div style="font-weight:600;font-size:0.9rem">${b.assets?.name || '—'}</div>
                     <div style="font-size:0.78rem;color:var(--text-2)">${shortDate(b.start_date)} → ${shortDate(b.end_date)}</div>
                   </div>
                   <div style="display:flex;align-items:center;gap:0.4rem">
                     <div style="width:8px;height:8px;border-radius:50%;background:${b.families?.color || 'var(--accent)'}"></div>
                     <span style="font-size:0.85rem;font-weight:500">${b.families?.name || '—'}</span>
                   </div>
                 </div>`).join('')}
             </div>`
          : `<div class="empty-state" style="padding:1.5rem"><div class="empty-icon">✅</div><p>No pickups scheduled</p></div>`
        }
      </div>

      <!-- Per-family breakdown -->
      <div class="card" style="grid-column:1/-1">
        <div class="card-header">
          <div class="card-title">👨‍👩‍👧 Family Breakdown</div>
        </div>
        ${familyBreakdown(custody)}
      </div>
    </div>
  `;
}

function trackerStat(icon, value, label) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div>
        <div class="stat-val">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;
}

function familyBreakdown(custody) {
  if (!custody || custody.length === 0)
    return `<div class="empty-state" style="padding:1rem"><p>No items currently out</p></div>`;

  // Group by family
  const byFamily = {};
  custody.forEach(c => {
    const fname = c.families?.name || 'Unknown';
    const fcolor = c.families?.color || 'var(--accent)';
    if (!byFamily[fname]) byFamily[fname] = { color: fcolor, items: [] };
    byFamily[fname].items.push(c);
  });

  return Object.entries(byFamily).map(([name, data]) => `
    <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.6rem">
        <div style="width:10px;height:10px;border-radius:50%;background:${data.color}"></div>
        <span style="font-weight:600">${name}</span>
        <span class="badge" style="background:${data.color}22;color:${data.color}">${data.items.length} item${data.items.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        ${data.items.map(c => `
          <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.75rem;font-size:0.85rem;display:flex;align-items:center;gap:0.4rem">
            ${c.assets?.categories?.icon || '📦'} ${c.assets?.name || '—'}
            <span style="color:var(--text-3);font-size:0.75rem">· ${shortDate(c.collected_at)}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function shortDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}
