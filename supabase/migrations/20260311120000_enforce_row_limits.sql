-- ============================================================
-- Row limit triggers — prevent any single user/scope from
-- inserting more rows than the configured maximum.
-- ============================================================

-- Reusable trigger function.
-- TG_ARGV[0] = max row count (integer)
-- TG_ARGV[1] = scope column name (e.g. 'user_id', 'session_id', 'thread_id')
-- Raises check_violation (ERRCODE 23514) with a human-readable message.
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

-- ─── Per-table triggers ───────────────────────────────────────

CREATE TRIGGER enforce_exercises_limit
  BEFORE INSERT ON exercises
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('500', 'user_id');

CREATE TRIGGER enforce_workout_sessions_limit
  BEFORE INSERT ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('2000', 'user_id');

CREATE TRIGGER enforce_workout_exercises_limit
  BEFORE INSERT ON workout_exercises
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('30', 'session_id');

CREATE TRIGGER enforce_workout_sets_limit
  BEFORE INSERT ON workout_sets
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('20', 'workout_exercise_id');

CREATE TRIGGER enforce_rooms_limit
  BEFORE INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('50', 'user_id');

CREATE TRIGGER enforce_plants_limit
  BEFORE INSERT ON plants
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('200', 'user_id');

CREATE TRIGGER enforce_care_schedules_limit
  BEFORE INSERT ON care_schedules
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('1200', 'user_id');

CREATE TRIGGER enforce_care_logs_limit
  BEFORE INSERT ON care_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('50000', 'user_id');

CREATE TRIGGER enforce_species_profiles_limit
  BEFORE INSERT ON species_profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('500', 'user_id');

CREATE TRIGGER enforce_todos_limit
  BEFORE INSERT ON todos
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('5000', 'user_id');

CREATE TRIGGER enforce_chat_threads_limit
  BEFORE INSERT ON chat_threads
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('200', 'user_id');

CREATE TRIGGER enforce_chat_messages_limit
  BEFORE INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('100', 'thread_id');
