-- ============================================================
-- Migration: Make exercises and workout tables multi-user
-- ============================================================

-- 1. Add user_id columns (nullable initially for backfill)
ALTER TABLE exercises ADD COLUMN user_id uuid REFERENCES auth.users(id);
ALTER TABLE workout_sessions ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- 2. Backfill all existing data to Kyle's account
UPDATE exercises SET user_id = '38f2f686-213b-4903-8209-d9a9bd7649f3';
UPDATE workout_sessions SET user_id = '38f2f686-213b-4903-8209-d9a9bd7649f3';

-- 3. Set NOT NULL now that all rows are backfilled
ALTER TABLE exercises ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE workout_sessions ALTER COLUMN user_id SET NOT NULL;

-- 4. Fix exercises unique constraint: (name) -> (user_id, name)
ALTER TABLE exercises DROP CONSTRAINT exercises_name_key;
ALTER TABLE exercises ADD CONSTRAINT exercises_user_name_key UNIQUE (user_id, name);

-- 5. Add indexes for user_id lookups
CREATE INDEX idx_exercises_user ON exercises (user_id);
CREATE INDEX idx_workout_sessions_user ON workout_sessions (user_id);

-- 6. Drop old RLS policies
DROP POLICY "Allow public read access" ON exercises;
DROP POLICY "Public read access" ON workout_sessions;
DROP POLICY "Authenticated delete" ON workout_sessions;
DROP POLICY "Public read access" ON workout_exercises;
DROP POLICY "Authenticated delete" ON workout_exercises;
DROP POLICY "Public read access" ON workout_sets;
DROP POLICY "Authenticated delete" ON workout_sets;

-- 7. Create new RLS policies on exercises (full CRUD, owner-only)
CREATE POLICY "exercises: owner select" ON exercises FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "exercises: owner insert" ON exercises FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "exercises: owner update" ON exercises FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "exercises: owner delete" ON exercises FOR DELETE
  USING (user_id = auth.uid());

-- 8. Create new RLS policies on workout_sessions (full CRUD, owner-only)
CREATE POLICY "workout_sessions: owner select" ON workout_sessions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "workout_sessions: owner insert" ON workout_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "workout_sessions: owner update" ON workout_sessions FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "workout_sessions: owner delete" ON workout_sessions FOR DELETE
  USING (user_id = auth.uid());

-- 9. Create new RLS policies on workout_exercises (scope via parent session)
CREATE POLICY "workout_exercises: owner select" ON workout_exercises FOR SELECT
  USING (EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));
CREATE POLICY "workout_exercises: owner insert" ON workout_exercises FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));
CREATE POLICY "workout_exercises: owner update" ON workout_exercises FOR UPDATE
  USING (EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));
CREATE POLICY "workout_exercises: owner delete" ON workout_exercises FOR DELETE
  USING (EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));

-- 10. Create new RLS policies on workout_sets (scope via grandparent session)
CREATE POLICY "workout_sets: owner select" ON workout_sets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workout_sessions ws ON ws.id = we.session_id
    WHERE we.id = workout_exercise_id AND ws.user_id = auth.uid()
  ));
CREATE POLICY "workout_sets: owner insert" ON workout_sets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workout_sessions ws ON ws.id = we.session_id
    WHERE we.id = workout_exercise_id AND ws.user_id = auth.uid()
  ));
CREATE POLICY "workout_sets: owner update" ON workout_sets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workout_sessions ws ON ws.id = we.session_id
    WHERE we.id = workout_exercise_id AND ws.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workout_sessions ws ON ws.id = we.session_id
    WHERE we.id = workout_exercise_id AND ws.user_id = auth.uid()
  ));
CREATE POLICY "workout_sets: owner delete" ON workout_sets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workout_sessions ws ON ws.id = we.session_id
    WHERE we.id = workout_exercise_id AND ws.user_id = auth.uid()
  ));

-- 11. Recreate views with security_invoker = true
DROP VIEW IF EXISTS exercise_summary;
CREATE VIEW exercise_summary WITH (security_invoker = true) AS
SELECT e.id AS exercise_id,
    e.name,
    e.category,
    e.current_working,
    max(ws.date) AS last_performed,
    count(DISTINCT ws.id) AS total_sessions,
    ( SELECT json_build_object('weight', pr_s.weight, 'weight_unit', pr_s.weight_unit, 'reps', pr_s.reps, 'date', pr_ws.date, 'notes', pr_s.notes)
           FROM ((workout_sets pr_s
             JOIN workout_exercises pr_we ON ((pr_s.workout_exercise_id = pr_we.id)))
             JOIN workout_sessions pr_ws ON ((pr_we.session_id = pr_ws.id)))
          WHERE ((pr_we.exercise_id = e.id) AND (pr_s.is_pr = true))
          ORDER BY pr_ws.date DESC
         LIMIT 1) AS latest_pr,
    max(s.duration_seconds) AS best_duration_seconds,
    max(s.weight) AS max_weight,
    ( SELECT json_build_object('weight', bw_s.weight, 'weight_unit', bw_s.weight_unit, 'reps', bw_s.reps)
           FROM (workout_sets bw_s
             JOIN workout_exercises bw_we ON ((bw_s.workout_exercise_id = bw_we.id)))
          WHERE ((bw_we.exercise_id = e.id) AND (bw_s.weight IS NOT NULL))
          ORDER BY bw_s.weight DESC, bw_s.reps DESC NULLS LAST
         LIMIT 1) AS best_weight_set
   FROM (((exercises e
     LEFT JOIN workout_exercises we ON ((we.exercise_id = e.id)))
     LEFT JOIN workout_sessions ws ON ((we.session_id = ws.id)))
     LEFT JOIN workout_sets s ON ((s.workout_exercise_id = we.id)))
  GROUP BY e.id, e.name, e.category, e.current_working;

DROP VIEW IF EXISTS exercise_recent_trend;
CREATE VIEW exercise_recent_trend WITH (security_invoker = true) AS
SELECT e.id AS exercise_id,
    e.name,
    ws.date,
    ws.id AS session_id,
    json_agg(json_build_object('set_number', s.set_number, 'reps', s.reps, 'weight', s.weight, 'weight_unit', s.weight_unit, 'duration_seconds', s.duration_seconds, 'is_pr', s.is_pr, 'notes', s.notes) ORDER BY s.set_number) AS sets
   FROM (((exercises e
     JOIN workout_exercises we ON ((we.exercise_id = e.id)))
     JOIN workout_sessions ws ON ((we.session_id = ws.id)))
     LEFT JOIN workout_sets s ON ((s.workout_exercise_id = we.id)))
  WHERE (ws.date >= ( SELECT COALESCE(( SELECT ws2.date
                   FROM (workout_exercises we2
                     JOIN workout_sessions ws2 ON ((we2.session_id = ws2.id)))
                  WHERE (we2.exercise_id = e.id)
                  ORDER BY ws2.date DESC
                 OFFSET 3
                 LIMIT 1), '1970-01-01'::date)))
  GROUP BY e.id, e.name, ws.date, ws.id
  ORDER BY e.name, ws.date DESC;

DROP VIEW IF EXISTS session_exercise_volume;
CREATE VIEW session_exercise_volume WITH (security_invoker = true) AS
SELECT ws.id AS session_id,
    ws.date,
    ws.title AS session_title,
    we.exercise_name,
    we.exercise_id,
    we.section,
    we."position",
    count(s.id) AS total_sets,
    sum(s.reps) AS total_reps,
    sum((COALESCE(s.weight, (0)::numeric) * (COALESCE((s.reps)::integer, 1))::numeric)) AS total_volume_lb,
    max(s.weight) AS max_weight_used,
    sum(s.duration_seconds) AS total_duration_seconds
   FROM ((workout_sessions ws
     JOIN workout_exercises we ON ((we.session_id = ws.id)))
     LEFT JOIN workout_sets s ON ((s.workout_exercise_id = we.id)))
  GROUP BY ws.id, ws.date, ws.title, we.exercise_name, we.exercise_id, we.section, we."position"
  ORDER BY ws.date DESC, we."position";
