/* ── Supabase client initialisation ──────────────────────── */

const CONFIG_KEY = 'familyshare_config';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); }
  catch { return null; }
}

function saveConfig(url, key) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key }));
}

function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

// Initialise client — returns null if not configured
function createSupabaseClient() {
  const cfg = getConfig();
  if (!cfg) return null;
  return supabase.createClient(cfg.url, cfg.key);
}

// Shared client instance (set in app.js after config confirmed)
let _db = null;

function getDB() {
  if (!_db) throw new Error('Supabase not initialised');
  return _db;
}

function initDB() {
  _db = createSupabaseClient();
  return _db;
}
