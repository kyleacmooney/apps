# Workout Logging to Supabase

Instructions for Claude.ai to log workout sessions to the Supabase database (project ID: `svmjtlsdyghxilpcdywc`) using `Supabase:execute_sql`. Use a single `DO $$ ... $$` block to insert everything atomically.

## Multi-user context

- The database is multi-user. Always include `user_id` when inserting into `exercises` and `workout_sessions`.
- Get the current user's ID with `auth.uid()` in RLS-enabled queries, or look up by email: `SELECT id FROM auth.users WHERE email = '<user_email>'`
- When querying exercises, scope by user: `SELECT id FROM exercises WHERE name = '...' AND user_id = auth.uid()`

## Schema: 3 tables

### `workout_sessions` — one row per session

- `user_id` (uuid FK to auth.users, NOT NULL — always set to the current user's ID)
- `date` (date, use correct year — currently 2026), `time_of_day` (text: morning/afternoon/evening/night), `title` (text), `location` (text: 'apartment gym', 'LA Fitness', 'home'), `session_type` (enum: workout/mobility/grip_training/sitting_practice/mixed), `status` (session_status enum: completed/planned, default 'completed'), `energy_level` (energy_level enum: low/moderate/high/full_send, nullable), `energy_rating` (smallint 1–10, nullable — ask at end of session), `body_state` (body_state enum: fresh/sore/tight/beat_up/recovering, nullable), `notes` (text — overall takeaways, PRs, injuries)

### `workout_exercises` — one row per exercise in the session

- `session_id` (FK), `exercise_id` (FK to exercises table, nullable — only link if the exercise exists in the encyclopedia), `exercise_name` (text, always populated), `section` (enum: warmup/main/accessory/cooldown), `position` (smallint — ordering within session, sequential starting at 1), `notes` (text, nullable)

### `workout_sets` — one row per set

- `workout_exercise_id` (FK), `set_number` (smallint), `reps` (smallint, nullable), `weight` (numeric, nullable), `weight_unit` (text, default 'lb'), `duration_seconds` (smallint, nullable), `is_pr` (boolean, default false), `notes` (text, nullable)

## Key rules

- Query the `exercises` table first to get current IDs for linking `exercise_id` where applicable — always filter by the current user's `user_id`
- Use nullable fields appropriately: reps-only exercises (pushups, dead bugs) have NULL weight/duration; timed exercises (hangs, wall sits) have NULL reps; carries have both duration and weight; stretches in cooldown may have no sets at all
- Flag PRs with `is_pr = true` and add context in set-level `notes`
- For exercise names that begin with `Assisted ` (for example `Assisted Pull-Up`), lower weight is better because the logged weight is assistance. Treat the least-assisted successful set as the PR candidate, not the heaviest assistance.
- For drop sets like "9 @ 75 + 3 @ 67.5", create two separate set rows with sequential set_numbers and note "drop set" on the second
- For bilateral exercises like pallof press, note "each side" in set notes
- Session `notes` should contain the summary/takeaways paragraph
- Always use year 2026 for dates (not 2025)
- Use 'workout' only when the session's primary purpose is structured lifting/training. If the primary purpose is mobility/stretches and only includes a minor exercise component (e.g., a quick baseline test, a single accessory movement), use 'mixed' instead.
- "mixed" is only for non-workout combos (e.g., standalone grip + mobility in one session).
- Ask about both `energy_level` and `body_state` at the start or end of each session. Both are nullable — skip if the person doesn't volunteer it.
- At the end of each workout session, ask for an energy_rating (1–10) reflecting how the person felt during the session (also nullable).

## Adding exercises to the encyclopedia

When logging a workout, if an exercise (including stretches and mobility work) doesn't already exist in the `exercises` table, add it before logging the session. Use `Supabase:execute_sql` to insert.

### `exercises` table schema

- `id` (uuid PK, default gen_random_uuid()), `user_id` (uuid FK to auth.users, NOT NULL), `name` (text, unique per user — constraint: `UNIQUE (user_id, name)`), `category` (exercise_category enum), `form_cues` (text, nullable), `common_mistakes` (text, nullable), `current_working` (text, nullable), `progression` (text, nullable), `detailed_walkthrough` (text, nullable), `personal_notes` (text, nullable), `created_at`/`updated_at` (timestamptz, default now())

### Category enum values

'Upper Pull', 'Upper Push', 'Lower', 'Core', 'Mobility & Posture', 'Grip', 'Cardio & Conditioning', 'Neck'

### Rules

- Add all exercises including stretches and mobility work — stretches go under 'Mobility & Posture' category
- Always include `user_id` when inserting exercises
- Populate `form_cues` with the key cues discussed during the session
- Populate `common_mistakes` if any form issues came up during the session
- Populate `current_working` with the weight/rep ranges from the current session (e.g. "3×15 @ 15lb" or "bodyweight, 5 reps"); for stretches, note hold duration (e.g. "30s each side")
- For assisted exercises, make it explicit in `current_working` and set notes that the number is assistance (for example `12@70 assist, 9@55 assist, 7@55 assist`) so lower weight is not misread as weaker performance.
- Populate `personal_notes` with any shoulder/grip/asymmetry notes specific to the user
- `progression` can be filled in if a clear next step was discussed, otherwise leave NULL
- After inserting, use the new ID to link `exercise_id` in the workout log
- After logging a session, update current_working on any existing exercises where the session reflects new weight/rep benchmarks or progression beyond what's currently recorded
- Keep `form_cues` concise (2-4 sentences max) — quick-reference setup, key positions, hold times
- Use `detailed_walkthrough` for in-depth breakdowns: step-by-step setup, variations, why certain cues matter, common compensation patterns. Only populate when an exercise has enough nuance to warrant it — not every exercise needs one.
- When updating an exercise's form_cues and the text is getting long or repetitive, move the detailed content to detailed_walkthrough and trim form_cues back to a summary.

## Planning a workout

When the user wants to plan their next workout, insert into the same 3 tables with `status = 'planned'`.

### Key differences from logging a completed session

- Set `status` to `'planned'` on the `workout_sessions` insert
- Use the intended workout date (or next day if unspecified)
- `energy_level`, `energy_rating`, and `body_state` should be NULL
- `time_of_day` can be set if the user specifies when they plan to train
- `title` should describe the planned session (e.g., "Upper Pull Day A")
- `notes` can include the plan's intent/focus (e.g., "Focus on progressive overload for rows")
- Sets should use target weights/reps (what the user intends to hit)
- `is_pr` should always be false for planned sets
- Only one planned session should exist at a time per user — if a previous plan exists, delete it first (`DELETE FROM workout_sessions WHERE status = 'planned' AND user_id = auth.uid()`, CASCADE FKs handle child rows)

### Example

```sql
DO $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_ex1_id uuid;
BEGIN
  -- Delete any existing planned session for this user
  DELETE FROM workout_sessions WHERE status = 'planned' AND user_id = v_user_id;

  INSERT INTO workout_sessions (user_id, date, title, session_type, status, location, notes)
  VALUES (v_user_id, '2026-03-10', 'Upper Pull Day', 'workout', 'planned', 'apartment gym',
          'Focus on heavy rows, add 2.5lb to DB rows')
  RETURNING id INTO v_session_id;

  INSERT INTO workout_exercises (session_id, exercise_name, exercise_id, section, position)
  VALUES (v_session_id, 'Dead Hang', (SELECT id FROM exercises WHERE name = 'Dead Hang' AND user_id = v_user_id), 'warmup', 1)
  RETURNING id INTO v_ex1_id;

  INSERT INTO workout_sets (workout_exercise_id, set_number, duration_seconds) VALUES
  (v_ex1_id, 1, 30);

  -- ... more exercises and sets ...
END $$;
```

### Dismissing a planned workout

The app has a "Dismiss Plan" button that deletes the planned session from the UI. Alternatively, the user can ask to delete the plan via conversation.
