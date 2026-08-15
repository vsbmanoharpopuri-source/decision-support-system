/* ═══════════════════════════════════════════════════════════════
   DECIDR — auth.js
   Phase 2: Email/Password authentication via Supabase Auth.
   - Sign Up / Log In / Log Out
   - Session check on load + persistence across refresh
   - Gates access to landing/dashboard behind a valid session
   Depends on `db` (the Supabase client) from supabaseClient.js,
   which must load before this file.
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Page gating helpers ───────────────────────────────────────
// Only one top-level page is ever "active" at a time: auth-page,
// landing-page, or dashboard-page. These helpers centralize that
// so auth state and the existing showDashboard()/showLanding()
// functions in script.js don't fight each other.
function showAuthPage() {
  document.getElementById('auth-page').classList.add('active');
  document.getElementById('landing-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.remove('active');
}

function showAppAfterAuth() {
  document.getElementById('auth-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.remove('active');
  document.getElementById('landing-page').classList.add('active');
  // Phase 4A: now that a session is confirmed, load (or create) the
  // user's decision and their options. Defined in script.js, which
  // has already finished loading/parsing by the time this ever runs.
  if (typeof loadAppData === 'function') loadAppData();
}

// ── Auth tab switching (Log In / Sign Up) ─────────────────────
function switchAuthTab(tab) {
  document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('auth-tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-form-login').classList.toggle('active', tab === 'login');
  document.getElementById('auth-form-signup').classList.toggle('active', tab === 'signup');
  setAuthMessage('');
}

function setAuthMessage(msg, type = '') {
  const el = document.getElementById('auth-message');
  el.textContent = msg;
  el.className = `auth-message${type ? ' ' + type : ''}`;
}

function setButtonLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : label;
}

// ── Sign Up ────────────────────────────────────────────────────
async function handleSignup(event) {
  event.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  setAuthMessage('');
  setButtonLoading('signup-submit-btn', true, 'Sign Up');

  const { data, error } = await db.auth.signUp({ email, password });

  setButtonLoading('signup-submit-btn', false, 'Sign Up');

  if (error) {
    setAuthMessage(error.message, 'error');
    return false;
  }

  // If email confirmation is required by the project's auth settings,
  // `session` will be null even though signUp succeeded — the account
  // exists but can't log in until confirmed. Handle both cases.
  if (!data.session) {
    setAuthMessage('Account created. Check your email to confirm before logging in.', 'success');
    switchAuthTab('login');
  } else {
    setAuthMessage('Account created — you\'re in!', 'success');
    showAppAfterAuth();
  }
  return false;
}

// ── Log In ─────────────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  setAuthMessage('');
  setButtonLoading('login-submit-btn', true, 'Log In');

  const { error } = await db.auth.signInWithPassword({ email, password });

  setButtonLoading('login-submit-btn', false, 'Log In');

  if (error) {
    setAuthMessage(error.message, 'error');
    return false;
  }

  showAppAfterAuth();
  return false;
}

// ── Log Out ────────────────────────────────────────────────────
async function handleLogout() {
  await db.auth.signOut();
  // Clear in-memory decision state on logout so the next user
  // (or the same user next session) doesn't see stale data.
  // resetAll() would prompt a confirm() dialog, which is wrong here —
  // logout should clear silently.
  if (typeof state !== 'undefined') {
    state.decisionId = null;
    state.options = [];
    state.criteria = [];
    state.scores = {};
    state.results = null;
    if (typeof renderOptions === 'function') renderOptions();
    if (typeof renderCriteria === 'function') renderCriteria();
    if (typeof updateSetupHint === 'function') updateSetupHint();
  }
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('signup-email').value = '';
  document.getElementById('signup-password').value = '';
  switchAuthTab('login');
  showAuthPage();
}

// ── Session check on load + persistence ───────────────────────
// supabase-js persists sessions in localStorage by default and
// refreshes tokens automatically, so a page refresh keeps the user
// logged in without any extra code from us — we just need to ask
// it what the current session is when the app boots.
async function checkInitialSession() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    console.error('[Auth] Failed to check session:', error.message);
    showAuthPage();
    return;
  }
  if (data.session) {
    showAppAfterAuth();
  } else {
    showAuthPage();
  }
}

// Also react to auth state changes that happen elsewhere (e.g. token
// refresh failing, or another tab logging out) so the UI stays in sync.
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    showAuthPage();
  }
});

document.addEventListener('DOMContentLoaded', checkInitialSession);
