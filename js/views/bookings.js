/* ── Bookings view ───────────────────────────────────────── */

let _calendarInstance = null;

async function renderBookings(container) {
  const db = getDB();
  const family = await getCurrentFamily();

  const [
    { data: allBookings },
    { data: myBookings }
  ] = await Promise.all([
    db.from('bookings')
      .select('*, assets(name, categories(icon)), families(name, color)')
      .not('status', 'in', '("cancelled")')
      .order('start_date'),
    db.from('bookings')
      .select('*, assets(name, categories(icon)), families(name, color)')
      .eq('family_id', family?.id || '')
      .order('start_date', { ascending: false })
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2>📅 Bookings</h2>
        <div class="page-sub">See the full schedule across all families and assets</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="calendar">📅 Calendar</button>
      <button class="tab-btn" data-tab="mine">My Bookings</button>
      <button class="tab-btn" data-tab="all">All Bookings</button>
    </div>

    <div id="tab-content">
      <div id="tab-calendar">${calendarPanel()}</div>
      <div id="tab-mine"    class="hidden">${myBookingsPanel(myBookings, family)}</div>
      <div id="tab-all"     class="hidden">${allBookingsPanel(allBookings)}</div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ['calendar','mine','all'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('hidden', btn.dataset.tab !== t);
      });
      if (btn.dataset.tab === 'calendar') initCalendar(allBookings);
    });
  });

  // Cancel booking buttons
  container.querySelectorAll('.cancel-booking').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Cancel this booking?')) return;
      const { error } = await db.from('bookings').update({ status: 'cancelled' }).eq('id', btn.dataset.id);
      if (error) return showToast(error.message, 'error');
      showToast('Booking cancelled', 'info');
      renderBookings(container);
    });
  });

  // Mark collected buttons
  container.querySelectorAll('.mark-collected').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const bookingId = btn.dataset.id;
      const assetId   = btn.dataset.asset;
      const db = getDB();
      // Update booking status
      await db.from('bookings').update({ status: 'active' }).eq('id', bookingId);
      // Create custody record
      await db.from('asset_custody').insert({
        asset_id:  assetId,
        booking_id: bookingId,
        family_id: family?.id
      });
      showToast('Marked as collected! 📦', 'success');
      renderBookings(container);
    });
  });

  // Mark returned buttons
  container.querySelectorAll('.mark-returned').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const bookingId = btn.dataset.id;
      const assetId   = btn.dataset.asset;
      await db.from('bookings').update({ status: 'returned' }).eq('id', bookingId);
      await db.from('asset_custody')
        .update({ returned_at: new Date().toISOString() })
        .eq('asset_id', assetId)
        .is('returned_at', null);
      showToast('Item returned! ✅', 'success');
      renderBookings(container);
    });
  });

  // Init calendar on first render
  initCalendar(allBookings);
}

function calendarPanel() {
  return `<div id="calendar-mount" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;margin-top:0.5rem"></div>`;
}

function initCalendar(bookings) {
  if (_calendarInstance) { _calendarInstance.destroy(); _calendarInstance = null; }
  const el = document.getElementById('calendar-mount');
  if (!el) return;

  const events = (bookings || []).map(b => ({
    id:    b.id,
    title: `${b.assets?.categories?.icon || '📦'} ${b.assets?.name || '?'} (${b.families?.name || '?'})`,
    start: b.start_date,
    end:   shiftDate(b.end_date, 1),   // FullCalendar end is exclusive
    color: b.families?.color || '#7c3aed',
    extendedProps: b
  }));

  _calendarInstance = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' },
    events,
    eventClick: info => showBookingDetail(info.event.extendedProps),
    height: 'auto',
    eventDisplay: 'block',
  });
  _calendarInstance.render();
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function myBookingsPanel(bookings, family) {
  if (!bookings || bookings.length === 0)
    return `<div class="empty-state"><div class="empty-icon">📅</div><h3>No bookings yet</h3><p>Head to Assets to book something!</p><button class="btn btn-primary" onclick="navigate('assets')">Browse Assets</button></div>`;

  const active    = bookings.filter(b => b.status === 'active');
  const upcoming  = bookings.filter(b => b.status === 'confirmed');
  const past      = bookings.filter(b => ['returned','cancelled'].includes(b.status));

  return `
    ${sectionBookings('🟢 Active (You Have It)', active, family, true)}
    ${sectionBookings('⏰ Upcoming', upcoming, family, false)}
    ${sectionBookings('🕐 Past', past, family, false, true)}
  `;
}

function sectionBookings(title, list, family, showReturn, isPast=false) {
  if (!list.length) return '';
  return `
    <div style="margin-bottom:1.25rem">
      <div style="font-weight:600;margin-bottom:0.75rem;color:var(--text-2);font-size:0.88rem;text-transform:uppercase;letter-spacing:0.05em">${title}</div>
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        ${list.map(b => `
          <div class="booking-item">
            <div class="booking-accent" style="background:${family?.color || 'var(--accent)'}"></div>
            <div class="booking-info">
              <div class="booking-title">${b.assets?.categories?.icon || '📦'} ${b.assets?.name || '—'}</div>
              <div class="booking-dates">${formatDateB(b.start_date)} → ${formatDateB(b.end_date)}${b.notes ? ` · ${b.notes}` : ''}</div>
            </div>
            <span class="badge badge-${b.status}">${b.status}</span>
            ${!isPast && b.status === 'confirmed' ? `
              <button class="btn btn-success btn-sm mark-collected" data-id="${b.id}" data-asset="${b.asset_id}">Collected</button>
              <button class="btn btn-danger btn-sm cancel-booking" data-id="${b.id}">Cancel</button>` : ''}
            ${b.status === 'active' ? `
              <button class="btn btn-secondary btn-sm mark-returned" data-id="${b.id}" data-asset="${b.asset_id}">Return</button>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

function allBookingsPanel(bookings) {
  if (!bookings || bookings.length === 0)
    return `<div class="empty-state"><div class="empty-icon">📅</div><h3>No bookings yet</h3></div>`;

  return `
    <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
      ${bookings.map(b => `
        <div class="booking-item" style="cursor:pointer" onclick='showBookingDetail(${JSON.stringify(b).replace(/'/g,"&#39;")})'>
          <div class="booking-accent" style="background:${b.families?.color || 'var(--accent)'}"></div>
          <div style="width:36px;height:36px;border-radius:8px;background:${b.families?.color || 'var(--accent)'}22;display:flex;align-items:center;justify-content:center;font-weight:700;color:${b.families?.color || 'var(--accent)'};font-size:0.9rem;flex-shrink:0">
            ${(b.families?.name || '?')[0]}
          </div>
          <div class="booking-info">
            <div class="booking-title">${b.assets?.categories?.icon || '📦'} ${b.assets?.name || '—'}</div>
            <div class="booking-dates">${b.families?.name || '—'} · ${formatDateB(b.start_date)} → ${formatDateB(b.end_date)}</div>
          </div>
          <span class="badge badge-${b.status}">${b.status}</span>
        </div>`).join('')}
    </div>`;
}

function showBookingDetail(b) {
  openModal(`
    <h2>${b.assets?.categories?.icon || '📦'} ${b.assets?.name || '—'}</h2>
    <div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:1rem">
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span style="color:var(--text-2);width:80px;font-size:0.88rem">Family</span>
        <span style="font-weight:600">${b.families?.name || '—'}</span>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span style="color:var(--text-2);width:80px;font-size:0.88rem">From</span>
        <span>${formatDateB(b.start_date)}</span>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span style="color:var(--text-2);width:80px;font-size:0.88rem">To</span>
        <span>${formatDateB(b.end_date)}</span>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span style="color:var(--text-2);width:80px;font-size:0.88rem">Status</span>
        <span class="badge badge-${b.status}">${b.status}</span>
      </div>
      ${b.notes ? `<div style="background:var(--bg-card2);border-radius:8px;padding:0.75rem;font-size:0.88rem;color:var(--text-2)">${b.notes}</div>` : ''}
    </div>
    <div style="text-align:right;margin-top:1.5rem">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `);
}

function formatDateB(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
