-- ═══════════════════════════════════════════════════════════════
-- Migration: phase3_rls_policies
-- Decidr — Decision Support System
-- ═══════════════════════════════════════════════════════════════
-- This migration was applied directly to the connected Supabase
-- project and verified there. This file is a record of that change
-- for version control — running it again on the same database will
-- fail with "policy already exists" since policies are already live.
--
-- RLS was already enabled on all four tables before this migration.
-- This migration ONLY adds policies. It does not:
--   - disable RLS on any table
--   - alter any table structure
--   - touch any existing data
--
-- See PHASE3_RLS_EXPLANATION.md for a plain-English walkthrough of
-- every policy below.

-- ── decisions ──────────────────────────────────────────────────
create policy "decisions_select_own"
on public.decisions
for select
to authenticated
using (auth.uid() = user_id);

create policy "decisions_insert_own"
on public.decisions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "decisions_update_own"
on public.decisions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decisions_delete_own"
on public.decisions
for delete
to authenticated
using (auth.uid() = user_id);


-- ── options ────────────────────────────────────────────────────
create policy "options_select_own"
on public.options
for select
to authenticated
using (
  exists (
    select 1 from public.decisions d
    where d.id = options.decision_id
      and d.user_id = auth.uid()
  )
);

create policy "options_insert_own"
on public.options
for insert
to authenticated
with check (
  exists (
    select 1 from public.decisions d
    where d.id = options.decision_id
      and d.user_id = auth.uid()
  )
);

create policy "options_update_own"
on public.options
for update
to authenticated
using (
  exists (
    select 1 from public.decisions d
    where d.id = options.decision_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.decisions d
    where d.id = options.decision_id
      and d.user_id = auth.uid()
  )
);

create policy "options_delete_own"
on public.options
for delete
to authenticated
using (
  exists (
    select 1 from public.decisions d
    where d.id = options.decision_id
      and d.user_id = auth.uid()
  )
);


-- ── criteria ───────────────────────────────────────────────────
create policy "criteria_select_own"
on public.criteria
for select
to authenticated
using (
  exists (
    select 1 from public.decisions d
    where d.id = criteria.decision_id
      and d.user_id = auth.uid()
  )
);

create policy "criteria_insert_own"
on public.criteria
for insert
to authenticated
with check (
  exists (
    select 1 from public.decisions d
    where d.id = criteria.decision_id
      and d.user_id = auth.uid()
  )
);

create policy "criteria_update_own"
on public.criteria
for update
to authenticated
using (
  exists (
    select 1 from public.decisions d
    where d.id = criteria.decision_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.decisions d
    where d.id = criteria.decision_id
      and d.user_id = auth.uid()
  )
);

create policy "criteria_delete_own"
on public.criteria
for delete
to authenticated
using (
  exists (
    select 1 from public.decisions d
    where d.id = criteria.decision_id
      and d.user_id = auth.uid()
  )
);


-- ── scores ─────────────────────────────────────────────────────
-- Both the referenced option AND the referenced criterion must
-- belong to one of the current user's own decisions.
create policy "scores_select_own"
on public.scores
for select
to authenticated
using (
  exists (
    select 1 from public.options o
    join public.decisions d on d.id = o.decision_id
    where o.id = scores.option_id
      and d.user_id = auth.uid()
  )
  and exists (
    select 1 from public.criteria c
    join public.decisions d on d.id = c.decision_id
    where c.id = scores.criterion_id
      and d.user_id = auth.uid()
  )
);

create policy "scores_insert_own"
on public.scores
for insert
to authenticated
with check (
  exists (
    select 1 from public.options o
    join public.decisions d on d.id = o.decision_id
    where o.id = scores.option_id
      and d.user_id = auth.uid()
  )
  and exists (
    select 1 from public.criteria c
    join public.decisions d on d.id = c.decision_id
    where c.id = scores.criterion_id
      and d.user_id = auth.uid()
  )
);

create policy "scores_update_own"
on public.scores
for update
to authenticated
using (
  exists (
    select 1 from public.options o
    join public.decisions d on d.id = o.decision_id
    where o.id = scores.option_id
      and d.user_id = auth.uid()
  )
  and exists (
    select 1 from public.criteria c
    join public.decisions d on d.id = c.decision_id
    where c.id = scores.criterion_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.options o
    join public.decisions d on d.id = o.decision_id
    where o.id = scores.option_id
      and d.user_id = auth.uid()
  )
  and exists (
    select 1 from public.criteria c
    join public.decisions d on d.id = c.decision_id
    where c.id = scores.criterion_id
      and d.user_id = auth.uid()
  )
);

create policy "scores_delete_own"
on public.scores
for delete
to authenticated
using (
  exists (
    select 1 from public.options o
    join public.decisions d on d.id = o.decision_id
    where o.id = scores.option_id
      and d.user_id = auth.uid()
  )
  and exists (
    select 1 from public.criteria c
    join public.decisions d on d.id = c.decision_id
    where c.id = scores.criterion_id
      and d.user_id = auth.uid()
  )
);
