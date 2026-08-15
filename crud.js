/* ═══════════════════════════════════════════════════════════════
   DECIDR — crud.js
   Database access layer for Decisions, Options, Criteria, Scores.

   Phase 4A added: Decisions (Create+Read), Options (Create+Read).
   Phase 4B adds:  Options (Update+Delete), Criteria (full CRUD),
                    Scores (Create/Update via upsert, Read, Delete).

   This file is a thin, pure data-access layer: every function here
   either returns data from Supabase or throws. It does NOT touch
   `state` and does NOT call any render function — that orchestration
   stays in script.js, so this file can be reasoned about and tested
   in isolation from the UI.

   Depends on `db` (the Supabase client) from supabaseClient.js,
   which must load before this file. All calls run under the current
   user's session, so every Phase 3 RLS policy applies automatically —
   there is no way to bypass them from here.
═══════════════════════════════════════════════════════════════ */

'use strict';

console.log('%c[Decidr] crud.js — PHASE 4B build (updateOption, deleteOption, criteria CRUD, scores CRUD present)', 'color:#4f88ff;font-weight:bold');

// ── Decisions (Create + Read) ─────────────────────────────────

/**
 * Fetch the current user's most recent decision, if one exists.
 * RLS (decisions_select_own) ensures this can only ever return
 * rows owned by the currently logged-in user.
 */
async function fetchUserDecision() {
  const { data, error } = await db
    .from('decisions')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Create a new decision row for the current user.
 * user_id must be set explicitly to the caller's own auth id —
 * the decisions_insert_own policy's WITH CHECK requires
 * auth.uid() = user_id, and the column has no default value.
 */
async function createDecision(title) {
  const { data: userData, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('No authenticated user — cannot create a decision.');

  const { data, error } = await db
    .from('decisions')
    .insert({ title, user_id: userData.user.id })
    .select('id, title, created_at')
    .single();

  if (error) throw error;
  return data;
}

// ── Options (full CRUD) ────────────────────────────────────────

/**
 * Fetch all options belonging to a given decision, oldest first.
 * RLS (options_select_own) ensures this only ever returns options
 * whose parent decision belongs to the current user.
 */
async function fetchOptions(decisionId) {
  const { data, error } = await db
    .from('options')
    .select('id, name, color, created_at')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new option under the given decision.
 * No user_id column exists on options — ownership is enforced by
 * options_insert_own checking that decision_id points to a decision
 * the current user owns.
 */
async function createOption(decisionId, name, color) {
  const { data, error } = await db
    .from('options')
    .insert({ decision_id: decisionId, name, color })
    .select('id, name, color, created_at')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an option's name.
 * options_update_own RLS policy restricts this to options whose
 * parent decision the current user owns.
 */
async function updateOption(optionId, name) {
  const { data, error } = await db
    .from('options')
    .update({ name })
    .eq('id', optionId)
    .select('id, name, color, created_at')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an option. The `scores_option_id_fkey` foreign key is
 * ON DELETE CASCADE, so any score rows referencing this option are
 * removed automatically by Postgres — no separate score-delete call
 * is needed here. Verified directly against the live database before
 * this function was written.
 */
async function deleteOption(optionId) {
  const { error } = await db.from('options').delete().eq('id', optionId);
  if (error) throw error;
}

// ── Criteria (full CRUD) ───────────────────────────────────────

async function fetchCriteria(decisionId) {
  const { data, error } = await db
    .from('criteria')
    .select('id, name, weight, created_at')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function createCriterion(decisionId, name, weight) {
  const { data, error } = await db
    .from('criteria')
    .insert({ decision_id: decisionId, name, weight })
    .select('id, name, weight, created_at')
    .single();

  if (error) throw error;
  return data;
}

async function updateCriterion(criterionId, name, weight) {
  const { data, error } = await db
    .from('criteria')
    .update({ name, weight })
    .eq('id', criterionId)
    .select('id, name, weight, created_at')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a criterion. Like options, `scores_criterion_id_fkey` is
 * ON DELETE CASCADE — related scores are removed automatically.
 */
async function deleteCriterion(criterionId) {
  const { error } = await db.from('criteria').delete().eq('id', criterionId);
  if (error) throw error;
}

// ── Scores (Create/Update via upsert, Read, Delete) ────────────

/**
 * Fetch every score row for a given set of option ids (i.e. every
 * score belonging to the current decision, since options are always
 * scoped to one decision). Scores have no decision_id column of
 * their own, so this is the correct way to scope the query.
 */
async function fetchScores(optionIds) {
  if (!optionIds || optionIds.length === 0) return [];
  const { data, error } = await db
    .from('scores')
    .select('id, option_id, criterion_id, score')
    .in('option_id', optionIds);

  if (error) throw error;
  return data || [];
}

/**
 * Create or update a score for a given option/criterion pair.
 * The `scores_option_id_criterion_id_key` UNIQUE constraint lets us
 * use a single upsert instead of a separate "does it exist?" check
 * plus insert-or-update branching. A first save inserts; editing the
 * same cell again updates the same row rather than duplicating it.
 */
async function upsertScore(optionId, criterionId, score) {
  const { data, error } = await db
    .from('scores')
    .upsert(
      { option_id: optionId, criterion_id: criterionId, score },
      { onConflict: 'option_id,criterion_id' }
    )
    .select('id, option_id, criterion_id, score')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a score (used when a user clears a score cell back to empty
 * rather than leaving a stale value in the database).
 */
async function deleteScore(optionId, criterionId) {
  const { error } = await db
    .from('scores')
    .delete()
    .eq('option_id', optionId)
    .eq('criterion_id', criterionId);
  if (error) throw error;
}
