-- ============================================================
-- Template schema for a fresh Supabase project (Apps backend)
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- This is the **Simple (no auth)** variant:
-- - Permissive RLS so the anon key can read/write everything
-- - user_id columns do NOT FK to auth.users — the app can still
--   simulate per-user data by sending a user_id from Kyle's shared
--   Supabase project even if your project has no auth configured.
--
-- If you later enable Google OAuth on your own Supabase project and
-- want real per-user access control, run docs/schema-auth.sql after
-- this file. That patch switches RLS to auth.uid()-based policies
-- while keeping the same table structure.
--
-- Do NOT create user_settings here — that table only lives on the
-- shared Supabase backend.
-- ============================================================

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE exercise_category AS ENUM (
  'Upper Pull', 'Upper Push', 'Lower', 'Core',
  'Mobility & Posture', 'Grip', 'Cardio & Conditioning', 'Neck'
);

CREATE TYPE session_type AS ENUM (
  'workout', 'mobility', 'grip_training', 'sitting_practice', 'mixed'
);

CREATE TYPE session_status AS ENUM ('completed', 'planned');

CREATE TYPE energy_level AS ENUM ('low', 'moderate', 'high', 'full_send');

CREATE TYPE body_state AS ENUM ('fresh', 'sore', 'tight', 'beat_up', 'recovering');

CREATE TYPE exercise_section AS ENUM ('warmup', 'main', 'accessory', 'cooldown');

CREATE TYPE care_type AS ENUM ('water', 'fertilize', 'mist', 'repot', 'clean', 'prune');

CREATE TYPE care_status AS ENUM ('done', 'skipped');

-- ============================================================
-- Workout / exercise tables
-- ============================================================

CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category exercise_category NOT NULL,
  form_cues text,
  common_mistakes text,
  current_working text,
  progression text,
  detailed_walkthrough text,
  personal_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  time_of_day text,
  title text,
  location text,
  session_type session_type NOT NULL,
  status session_status DEFAULT 'completed',
  energy_level energy_level,
  energy_rating smallint,
  body_state body_state,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises(id),
  exercise_name text NOT NULL,
  section exercise_section NOT NULL,
  "position" smallint NOT NULL,
  notes text
);

CREATE TABLE workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number smallint NOT NULL,
  reps smallint,
  weight numeric,
  weight_unit text DEFAULT 'lb',
  duration_seconds smallint,
  is_pr boolean DEFAULT false,
  notes text
);

-- Indexes for user scoping (used when auth is enabled later)
CREATE INDEX idx_exercises_user ON exercises (user_id);
CREATE INDEX idx_workout_sessions_user ON workout_sessions (user_id);

-- ============================================================
-- Plant tables
-- ============================================================

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid REFERENCES rooms(id),
  nickname text NOT NULL,
  species_common_name text NOT NULL,
  species_scientific_name text,
  species_thumbnail_url text,
  pot_material text,
  pot_size text,
  light_level text,
  notes text,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE care_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  care_type care_type NOT NULL,
  interval_days integer NOT NULL,
  is_custom boolean DEFAULT false,
  next_due date NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (plant_id, care_type)
);

CREATE TABLE care_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plant_id uuid NOT NULL REFERENCES plants(id),
  care_type care_type NOT NULL,
  status care_status NOT NULL,
  performed_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE species_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  species_common_name text NOT NULL,
  species_scientific_name text,
  image_url text,
  watering_interval_days integer,
  humidity_preference text,
  temperature_min_f integer,
  temperature_max_f integer,
  dormancy_months integer[],
  fertilize_interval_days integer,
  misting_needed boolean,
  care_summary text,
  common_problems text,
  propagation_tips text,
  seasonal_care_notes text,
  fun_facts text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, species_common_name)
);

-- ============================================================
-- RLS: permissive (anon can read/write) — Phase 4 adds auth-gated policies
-- ============================================================

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE species_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated full access (permissive for single-user / optional auth)
CREATE POLICY "exercises: anon all" ON exercises FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "exercises: authenticated all" ON exercises FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "workout_sessions: anon all" ON workout_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "workout_sessions: authenticated all" ON workout_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "workout_exercises: anon all" ON workout_exercises FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "workout_exercises: authenticated all" ON workout_exercises FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "workout_sets: anon all" ON workout_sets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "workout_sets: authenticated all" ON workout_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "rooms: anon all" ON rooms FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "rooms: authenticated all" ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "plants: anon all" ON plants FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "plants: authenticated all" ON plants FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "care_schedules: anon all" ON care_schedules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "care_schedules: authenticated all" ON care_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "care_logs: anon all" ON care_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "care_logs: authenticated all" ON care_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "species_profiles: anon all" ON species_profiles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "species_profiles: authenticated all" ON species_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Views (workout aggregates; RLS on base tables applies)
-- ============================================================

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
          ORDER BY pr_ws.date DESC,
            CASE
              WHEN lower(e.name) LIKE 'assisted %' THEN pr_s.weight
            END ASC NULLS LAST,
            CASE
              WHEN lower(e.name) NOT LIKE 'assisted %' THEN pr_s.weight
            END DESC NULLS LAST,
            pr_s.reps DESC NULLS LAST,
            pr_s.set_number DESC
         LIMIT 1) AS latest_pr,
    max(s.duration_seconds) AS best_duration_seconds,
    max(s.weight) AS max_weight,
    ( SELECT json_build_object('weight', bw_s.weight, 'weight_unit', bw_s.weight_unit, 'reps', bw_s.reps)
           FROM (workout_sets bw_s
             JOIN workout_exercises bw_we ON ((bw_s.workout_exercise_id = bw_we.id)))
          WHERE ((bw_we.exercise_id = e.id) AND (bw_s.weight IS NOT NULL))
          ORDER BY CASE
              WHEN lower(e.name) LIKE 'assisted %' THEN bw_s.weight
            END ASC NULLS LAST,
            CASE
              WHEN lower(e.name) NOT LIKE 'assisted %' THEN bw_s.weight
            END DESC NULLS LAST,
            bw_s.reps DESC NULLS LAST,
            bw_s.set_number DESC
         LIMIT 1) AS best_weight_set
   FROM (((exercises e
     LEFT JOIN workout_exercises we ON ((we.exercise_id = e.id)))
     LEFT JOIN workout_sessions ws ON ((we.session_id = ws.id)))
     LEFT JOIN workout_sets s ON ((s.workout_exercise_id = we.id)))
  GROUP BY e.id, e.name, e.category, e.current_working;

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

-- ============================================================
-- Todos
-- ============================================================

CREATE TABLE todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  category text NOT NULL DEFAULT 'personal',
  recurring_interval text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_todos_user ON todos (user_id);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos: anon all" ON todos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "todos: authenticated all" ON todos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Chat
-- ============================================================

CREATE TABLE chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_threads_user ON chat_threads (user_id);
CREATE INDEX idx_chat_messages_thread ON chat_messages (thread_id);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_threads: anon all" ON chat_threads FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "chat_threads: authenticated all" ON chat_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "chat_messages: anon all" ON chat_messages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "chat_messages: authenticated all" ON chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Row limit triggers — prevent abuse by capping rows per scope
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_row_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_rows  integer := TG_ARGV[0]::integer;
  scope_col text    := TG_ARGV[1];
  scope_val text;
  cur_count integer;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', scope_col) INTO scope_val USING NEW;

  EXECUTE format(
    'SELECT count(*)::integer FROM %I.%I WHERE %I = $1',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, scope_col
  ) INTO cur_count USING scope_val;

  IF cur_count >= max_rows THEN
    RAISE EXCEPTION 'Row limit exceeded: % allows at most % rows per %',
      TG_TABLE_NAME, max_rows, scope_col
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_exercises_limit
  BEFORE INSERT ON exercises FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('500', 'user_id');
CREATE TRIGGER enforce_workout_sessions_limit
  BEFORE INSERT ON workout_sessions FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('2000', 'user_id');
CREATE TRIGGER enforce_workout_exercises_limit
  BEFORE INSERT ON workout_exercises FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('30', 'session_id');
CREATE TRIGGER enforce_workout_sets_limit
  BEFORE INSERT ON workout_sets FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('20', 'workout_exercise_id');
CREATE TRIGGER enforce_rooms_limit
  BEFORE INSERT ON rooms FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('50', 'user_id');
CREATE TRIGGER enforce_plants_limit
  BEFORE INSERT ON plants FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('200', 'user_id');
CREATE TRIGGER enforce_care_schedules_limit
  BEFORE INSERT ON care_schedules FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('1200', 'user_id');
CREATE TRIGGER enforce_care_logs_limit
  BEFORE INSERT ON care_logs FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('50000', 'user_id');
CREATE TRIGGER enforce_species_profiles_limit
  BEFORE INSERT ON species_profiles FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('500', 'user_id');
CREATE TRIGGER enforce_todos_limit
  BEFORE INSERT ON todos FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('5000', 'user_id');
CREATE TRIGGER enforce_chat_threads_limit
  BEFORE INSERT ON chat_threads FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('200', 'user_id');
CREATE TRIGGER enforce_chat_messages_limit
  BEFORE INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('100', 'thread_id');

-- ============================================================
-- Storage: plant-photos bucket (public read, anon write for app uploads)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "plant-photos: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'plant-photos');

CREATE POLICY "plant-photos: anon insert"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'plant-photos');

CREATE POLICY "plant-photos: anon update"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'plant-photos');

CREATE POLICY "plant-photos: authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'plant-photos');

CREATE POLICY "plant-photos: authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'plant-photos');
