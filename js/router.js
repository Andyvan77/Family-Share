/* ── Hash-based SPA router ───────────────────────────────── */

const VIEWS = {
  dashboard: { title: 'Dashboard',  render: renderDashboard },
  assets:    { title: 'Assets',     render: renderAssets    },
  bookings:  { title: 'Bookings',   render: renderBookings  },
  tracker:   { title: 'Tracker',    render: renderTracker   },
  family:    { title: 'My Family',  render: renderFamily    },
};

let _currentView = null;

function getViewFromHash() {
  const hash = (location.hash || '#dashboard').replace('#', '').split('?')[0];
  return VIEWS[hash] ? hash : 'dashboard';
}

async function navigate(viewName) {
  if (!viewName) viewName = getViewFromHash();
  const view = VIEWS[viewName];
  if (!view) return;

  // Update hash without triggering hashchange
  history.replaceState(null, '', `#${viewName}`);

  // Highlight active nav link
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });

  // Update topbar title
  document.getElementById('topbar-title').textContent = view.title;

  // Show spinner
  const container = document.getElementById('view-container');
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading…</p></div>';

  _currentView = viewName;

  try {
    await view.render(container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error loading view</h3><p>${err.message}</p></div>`;
    console.error(err);
  }
}

function initRouter() {
  // Nav link clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const view = link.dataset.view;
      navigate(view);
      // Close sidebar on mobile
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Browser back/forward
  window.addEventListener('hashchange', () => navigate(getViewFromHash()));

  // Initial navigation
  navigate(getViewFromHash());
}
