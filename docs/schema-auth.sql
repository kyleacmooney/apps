-- ============================================================
-- Auth-gated RLS patch for a fresh Supabase project (Apps backend)
-- ============================================================
-- Run this AFTER docs/schema.sql if you enable Google OAuth.
-- This switches from permissive anon/authenticated policies to
-- auth-gated policies that scope data by auth.uid().
-- ============================================================

-- Exercises
DROP POLICY IF EXISTS "exercises: anon all" ON exercises;
DROP POLICY IF EXISTS "exercises: authenticated all" ON exercises;

CREATE POLICY "exercises: owner" ON exercises
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Workout sessions
DROP POLICY IF EXISTS "workout_sessions: anon all" ON workout_sessions;
DROP POLICY IF EXISTS "workout_sessions: authenticated all" ON workout_sessions;

CREATE POLICY "workout_sessions: owner" ON workout_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Workout exercises
DROP POLICY IF EXISTS "workout_exercises: anon all" ON workout_exercises;
DROP POLICY IF EXISTS "workout_exercises: authenticated all" ON workout_exercises;

CREATE POLICY "workout_exercises: owner" ON workout_exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      WHERE ws.id = session_id
        AND ws.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      WHERE ws.id = session_id
        AND ws.user_id = auth.uid()
    )
  );

-- Workout sets
DROP POLICY IF EXISTS "workout_sets: anon all" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets: authenticated all" ON workout_sets;

CREATE POLICY "workout_sets: owner" ON workout_sets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = workout_exercise_id
        AND ws.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = workout_exercise_id
        AND ws.user_id = auth.uid()
    )
  );

-- Rooms
DROP POLICY IF EXISTS "rooms: anon all" ON rooms;
DROP POLICY IF EXISTS "rooms: authenticated all" ON rooms;

CREATE POLICY "rooms: owner" ON rooms
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Plants
DROP POLICY IF EXISTS "plants: anon all" ON plants;
DROP POLICY IF EXISTS "plants: authenticated all" ON plants;

CREATE POLICY "plants: owner" ON plants
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Care schedules
DROP POLICY IF EXISTS "care_schedules: anon all" ON care_schedules;
DROP POLICY IF EXISTS "care_schedules: authenticated all" ON care_schedules;

CREATE POLICY "care_schedules: owner" ON care_schedules
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Care logs
DROP POLICY IF EXISTS "care_logs: anon all" ON care_logs;
DROP POLICY IF EXISTS "care_logs: authenticated all" ON care_logs;

CREATE POLICY "care_logs: owner" ON care_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Species profiles
DROP POLICY IF EXISTS "species_profiles: anon all" ON species_profiles;
DROP POLICY IF EXISTS "species_profiles: authenticated all" ON species_profiles;

CREATE POLICY "species_profiles: owner" ON species_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- User secrets
CREATE TABLE IF NOT EXISTS user_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  claude_oauth_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_secrets: owner" ON user_secrets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
