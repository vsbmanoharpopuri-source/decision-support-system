# Phase 3: Row Level Security — Explained Simply

## What is Row Level Security (RLS)?

Normally, when your app asks the database for data — "give me all rows from
the `decisions` table" — the database just hands over every row that matches,
no questions asked. That's fine for a private script, but dangerous for an
app where many different people share the same tables.

**Row Level Security (RLS)** is a Postgres feature that adds an invisible
filter to every single query. Instead of "give me all rows," it becomes
"give me all rows — but only the ones this specific policy allows for this
specific user." The database enforces this itself, at the lowest level,
so there's no way to bypass it by tweaking frontend code.

Think of it like a library where every book has an invisible sticky note
that says "only Bhuvan may read this." Even if someone walks up to the
shelf directly, the note stops them — it doesn't matter how they got to
the shelf.

## Why RLS is important

Your Supabase publishable key is, by design, visible in your frontend
JavaScript. Anyone who opens your website's dev tools can see it and could,
in theory, send requests straight to your database using that key. Without
RLS, that means **anyone could read or change anyone else's decisions**,
just by knowing your project URL.

RLS is what makes it safe to expose that key publicly. It doesn't matter
who's asking or how they're asking — Postgres itself checks every row.

## The tables and how they connect

| Table | Owned by (directly or indirectly) |
|---|---|
| `decisions` | `user_id` column — direct ownership |
| `options` | belongs to a `decisions` row via `decision_id` |
| `criteria` | belongs to a `decisions` row via `decision_id` |
| `scores` | belongs to an `options` row AND a `criteria` row |

Only `decisions` has a `user_id` column. The other three tables don't know
who owns them directly — ownership has to be traced back through the
relationships (`options.decision_id → decisions.id`, and so on).

## What `auth.uid()` is and why it's used

When a user logs in through Supabase Auth (Phase 2), Supabase issues them a
signed token that identifies who they are. Every request the frontend
makes after that includes this token.

`auth.uid()` is a special function that reads that token and returns
**the currently logged-in user's ID** — and nothing else. It cannot be
faked or overridden by the frontend, because it comes from the verified
token, not from anything the browser sends as plain data.

Every single policy in this project compares `auth.uid()` against a
`user_id` somewhere — that comparison **is** the entire security model.

## What `USING` means

`USING` controls **which existing rows you're allowed to see or touch**.
It applies to `SELECT`, `UPDATE`, and `DELETE`.

Example, in plain English:
> "You may only select/update/delete a decision `USING` the rule that
> your user ID matches that decision's `user_id`."

If a row doesn't satisfy the `USING` condition, it's as if that row
doesn't exist for you — not "access denied," just invisible.

## What `WITH CHECK` means

`WITH CHECK` controls **what new or edited data you're allowed to write**.
It applies to `INSERT` and `UPDATE`.

Example, in plain English:
> "You may only insert a new decision `WITH CHECK` that the `user_id`
> you're setting on it matches your own ID."

Without `WITH CHECK`, a clever user could theoretically insert a row
owned by *someone else*. `WITH CHECK` closes that door.

For `UPDATE`, both apply together: `USING` decides which row you're
allowed to start editing, and `WITH CHECK` decides whether the *result*
of your edit is still something you're allowed to have written.

## Every policy created, and why

### `decisions` (4 policies)
- **`decisions_select_own`** — a user can only see decisions where
  `auth.uid() = user_id`.
- **`decisions_insert_own`** — a user can only create a decision if the
  `user_id` they're saving on it is their own ID (stops one user from
  creating a decision "as" someone else).
- **`decisions_update_own`** — a user can only edit a decision they
  already own, and can't change its ownership to someone else.
- **`decisions_delete_own`** — a user can only delete their own decisions.

### `options` (4 policies)
Options don't have a `user_id` column, so each policy uses a subquery:
*"does the decision this option belongs to have `user_id = auth.uid()`?"*
This means owning an option is entirely inherited from owning its parent
decision — there's no separate concept of "option ownership."

### `criteria` (4 policies)
Identical pattern to `options`, just checked against `criteria.decision_id`
instead.

### `scores` (4 policies)
A score references *two* things — an option and a criterion — so each
policy checks *both*:
1. Does the referenced option belong to one of my decisions?
2. Does the referenced criterion belong to one of my decisions?

Both must be true. This was written as two separate `EXISTS` checks
(rather than assuming the option and criterion always belong to the
same decision) specifically to avoid an overly permissive policy — even
if the app's own logic always pairs them correctly today, the database
doesn't rely on the app being correct.

## How this protects one user's data from another

Imagine User A and User B are both logged in.

- User A runs "get all my decisions." Postgres silently adds
  `WHERE user_id = 'user-a-id'` behind the scenes. User B's decisions
  were never even in the running — not hidden, *excluded before A's
  query saw them*.
- If User A somehow guesses User B's decision ID and tries
  `UPDATE decisions SET title = 'hacked' WHERE id = 'user-bs-id'`, the
  `USING` clause checks ownership first. Since `auth.uid()` (User A) does
  not equal `user_id` (User B), **zero rows match** — the update silently
  affects nothing. No error, no data change, no leak.

This was tested directly against the live database as part of this phase:
an anonymous (logged-out) request saw zero rows; a logged-in user saw only
their own decision/option/criterion/score; attempts to edit or delete
another user's rows affected nothing; and an attempt to insert a score
pointing at another user's option/criterion was rejected outright.

## How this works together with Phase 2 (Authentication)

Phase 2 answers **"who are you?"** — it verifies an email/password and
hands back a signed session token, and Supabase's client library keeps
that token attached to every request automatically.

Phase 3 answers **"what are you allowed to do?"** — using the identity
that Phase 2 already verified. Auth without RLS would mean anyone logged
in could see everyone's data. RLS without Auth would have nothing to
check against, since `auth.uid()` would always be empty. They're two
halves of the same lock: Auth proves identity, RLS enforces boundaries
based on that identity.

## What's still coming (Phase 4+)

These policies are enforcing rules against an **empty** database right
now — there's no CRUD code yet to actually create decisions, options,
criteria, or scores from the UI. That's Phase 4 onward. This phase just
makes sure that once that code exists, it will be structurally impossible
for it to leak one user's data to another, even by accident.
