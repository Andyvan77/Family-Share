/* ── Auth helpers ────────────────────────────────────────── */

let _currentUser = null;
let _currentProfile = null;
let _currentFamily = null;

async function getCurrentUser() { return _currentUser; }
async function getCurrentProfile() { return _currentProfile; }
async function getCurrentFamily() { return _currentFamily; }

async function loadUserContext() {
  const db = getDB();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  _currentUser = user;

  const { data: profile } = await db
    .from('profiles')
    .select('*, families(*)')
    .eq('id', user.id)
    .single();

  if (profile) {
    _currentProfile = profile;
    _currentFamily  = profile.families;
  }
  return user;
}

async function signIn(email, password) {
  const db = getDB();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await loadUserContext();
}

async function signUp(email, password, displayName, familyId, newFamilyData) {
  const db = getDB();

  // Create auth user
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { data: { display_name: displayName } }
  });
  if (error) throw error;
  const userId = data.user.id;

  // Wait briefly for trigger to create profile
  await new Promise(r => setTimeout(r, 800));

  let fid = familyId;

  if (newFamilyData) {
    // Create new family
    const { data: fam, error: ferr } = await db
      .from('families')
      .insert({ name: newFamilyData.name, color: newFamilyData.color })
      .select()
      .single();
    if (ferr) throw ferr;
    fid = fam.id;
  }

  // Update profile
  const { error: perr } = await db
    .from('profiles')
    .update({ display_name: displayName, family_id: fid, role: newFamilyData ? 'admin' : 'member' })
    .eq('id', userId);
  if (perr) throw perr;

  await loadUserContext();
}

async function signOut() {
  const db = getDB();
  await db.auth.signOut();
  _currentUser    = null;
  _currentProfile = null;
  _currentFamily  = null;
}

// Apply family colour theme to CSS variables
function applyFamilyTheme(color) {
  if (!color) return;
  document.documentElement.style.setProperty('--accent', color);
  // Compute dim/glow from hex
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  document.documentElement.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.15)`);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.35)`);
}
