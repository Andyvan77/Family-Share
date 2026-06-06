/* ── Dashboard view ──────────────────────────────────────── */

async function renderDashboard(container) {
  const db = getDB();
  const family = await getCurrentFamily();
  const profile = await getCurrentProfile();

  // Fetch stats in parallel
  const [
    { count: totalAssets },
    { count: activeBookings },
    { data: myUpcoming },
    { data: recentActivity },
    { data: custody }
  ] = await Promise.all([
    db.from('assets').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('bookings')
      .select('*, assets(name, category_id, categories(icon)), families(name, color)')
      .eq('family_id', family?.id || '')
      .in('status', ['confirmed', 'active'])
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('start_date')
      .limit(5),
    db.from('bookings')
      .select('*, assets(name), families(name, color)')
      .order('created_at', { ascending: false })
      .limit(8),
    db.from('asset_custody')
      .select('*, assets(name), families(name, color)')
      .is('returned_at', null)
      .limit(10)
  ]);

  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2>👋 Welcome back, ${profile?.display_name || 'there'}!</h2>
        <div class="page-sub">${family?.name || 'No family yet'} · ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}</div>
      </div>
      <button class="btn btn-primary" onclick="navigate('assets')">+ Add Asset</button>
    </div>

    <!-- Stat cards -->
    <div class="grid-4" style="margin-bottom:1.5rem">
      ${statCard('🎮', totalAssets ?? 0, 'Shared Assets')}
      ${statCard('📅', activeBookings ?? 0, 'Items Out Now')}
      ${statCard('⏰', myUpcoming?.filter(b => b.start_date === today).length ?? 0, 'Starting Today')}
      ${statCard('👨‍👩‍👧', family ? '✓' : '—', 'My Family')}
    </div>

    <div class="grid-2">
      <!-- My upcoming bookings -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📅 My Upcoming Bookings</div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('bookings')">View all →</button>
        </div>
        ${myUpcoming && myUpcoming.length > 0
          ? myUpcoming.map(b => bookingListItem(b)).join('')
          : `<div class="empty-state" style="padding:1.5rem">
               <div class="empty-icon">📅</div>
               <p>No upcoming bookings</p>
               <button class="btn btn-primary btn-sm" onclick="navigate('bookings')">Book Something</button>
             </div>`
        }
      </div>

      <!-- Currently out -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📍 Currently Out</div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('tracker')">Full tracker →</button>
        </div>
        ${custody && custody.length > 0
          ? custody.map(c => `
            <div class="custody-row" style="margin-bottom:0.5rem">
              <div class="custody-dot"></div>
              <div class="custody-asset">${c.assets?.name || '—'}</div>
              <div class="custody-who">
                <span class="badge badge-active">${c.families?.name || '—'}</span>
              </div>
            </div>`).join('')
          : `<div class="empty-state" style="padding:1.5rem"><div class="empty-icon">🏠</div><p>All items are home!</p></div>`
        }
      </div>

      <!-- Recent activity -->
      <div class="card" style="grid-column: 1 / -1">
        <div class="card-header">
          <div class="card-title">🕐 Recent Activity</div>
        </div>
        ${recentActivity && recentActivity.length > 0
          ? `<div style="display:flex;flex-direction:column;gap:0.5rem">
               ${recentActivity.map(b => `
                 <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
                   <div style="width:8px;height:8px;border-radius:50%;background:${b.families?.color || 'var(--accent)'};flex-shrink:0"></div>
                   <div style="flex:1;font-size:0.88rem">
                     <strong>${b.families?.name || '—'}</strong> booked <strong>${b.assets?.name || '—'}</strong>
                   </div>
                   <div style="font-size:0.78rem;color:var(--text-2)">${formatDate(b.start_date)} – ${formatDate(b.end_date)}</div>
                   <span class="badge badge-${b.status}">${b.status}</span>
                 </div>`).join('')}
             </div>`
          : `<div class="empty-state" style="padding:1.5rem"><p>No activity yet</p></div>`
        }
      </div>
    </div>
  `;
}

function statCard(icon, value, label) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div>
        <div class="stat-val">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;
}

function bookingListItem(b) {
  const icon = b.assets?.categories?.icon || '📦';
  return `
    <div class="booking-item" style="margin-bottom:0.5rem">
      <div class="booking-accent" style="background:${b.families?.color || 'var(--accent)'}"></div>
      <div class="booking-info">
        <div class="booking-title">${icon} ${b.assets?.name || '—'}</div>
        <div class="booking-dates">${formatDate(b.start_date)} → ${formatDate(b.end_date)}</div>
      </div>
      <span class="badge badge-${b.status}">${b.status}</span>
    </div>`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}
