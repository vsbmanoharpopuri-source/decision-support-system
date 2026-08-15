/* ═══════════════════════════════════════════════════════════════
   DECIDR — supabaseClient.js
   Phase 1: Supabase client initialization + connection check ONLY.
   No auth, no CRUD wiring happens here yet — that's later phases.
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Config ─────────────────────────────────────────────────────
// The publishable key is safe to expose in client-side code by design
// (it's the whole point of "publishable" vs "secret" keys). Real data
// protection comes from Row Level Security policies on the database,
// not from hiding this key. We still isolate it here in one place so
// it's easy to swap later (e.g. if you rotate keys or add env-based
// config with a build step).
const SUPABASE_URL = 'https://xdkdkmistzaezxchhwtz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_bg8y__7w60olZW3pe1ijVw_T5TaynxY';

// `window.supabase` here refers to the UMD global from the CDN script
// tag loaded in index.html (the SDK itself, not our client instance).
// We create our actual client and expose it as `window.db` so script.js
// (and future phases) can call `db.from(...)`, `db.auth...`, etc.
// without name-colliding with the SDK global.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
window.db = db;

// ── Connection verification ───────────────────────────────────
// A lightweight, read-only check: ask Postgres for the row count on
// `decisions` without fetching any rows (head: true). This proves the
// URL, key, and network path all work end-to-end. It does NOT require
// auth or RLS policies to succeed — a head-count request against a
// table with RLS enabled and no policies still returns a valid
// (zero) count response rather than failing, so this is a safe check
// to run before Phase 2/3 exist.
async function verifySupabaseConnection() {
  const indicator = document.getElementById('db-status');
  try {
    const { error } = await db.from('decisions').select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.log('[Supabase] Connected successfully to', SUPABASE_URL);
    if (indicator) {
      indicator.textContent = 'Supabase: connected';
      indicator.classList.add('db-status-ok');
    }
  } catch (err) {
    console.error('[Supabase] Connection check failed:', err.message || err);
    if (indicator) {
      indicator.textContent = 'Supabase: connection failed';
      indicator.classList.add('db-status-error');
    }
  }
}

document.addEventListener('DOMContentLoaded', verifySupabaseConnection);
