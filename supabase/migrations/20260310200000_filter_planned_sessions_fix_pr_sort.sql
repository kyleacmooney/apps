-- ============================================================
-- Migration: Filter planned sessions from exercise views;
--            fix PR sort to all-time best instead of most recent
-- ============================================================

-- exercise_summary: exclude planned sessions from all aggregations,
-- and sort latest_pr by strength (not most recent date)
DROP VIEW IF EXISTS exercise_summary;
CREATE VIEW exercise_summary WITH (security_invoker = true) AS
SELECT e.id AS exercise_id,
    e.name,
    e.category,
    e.current_working,
    max(ws.date) AS last_performed,
    count(DISTINCT ws.id) AS total_sessions,
    (
      SELECT json_build_object(
        'weight', pr_s.weight,
        'weight_unit', pr_s.weight_unit,
        'reps', pr_s.reps,
        'date', pr_ws.date,
        'notes', pr_s.notes
      )
      FROM (
        (workout_sets pr_s
          JOIN workout_exercises pr_we ON (pr_s.workout_exercise_id = pr_we.id))
          JOIN workout_sessions pr_ws ON (pr_we.session_id = pr_ws.id AND pr_ws.status = 'completed')
      )
      WHERE (pr_we.exercise_id = e.id AND pr_s.is_pr = true)
      ORDER BY
        CASE WHEN lower(e.name) LIKE 'assisted %' THEN pr_s.weight END ASC NULLS LAST,
        CASE WHEN lower(e.name) NOT LIKE 'assisted %' THEN pr_s.weight END DESC NULLS LAST,
        pr_s.reps DESC NULLS LAST,
        pr_s.set_number DESC
      LIMIT 1
    ) AS latest_pr,
    max(s.duration_seconds) AS best_duration_seconds,
    max(s.weight) AS max_weight,
    (
      SELECT json_build_object(
        'weight', bw_s.weight,
        'weight_unit', bw_s.weight_unit,
        'reps', bw_s.reps
      )
      FROM (workout_sets bw_s
        JOIN workout_exercises bw_we ON (bw_s.workout_exercise_id = bw_we.id)
        JOIN workout_sessions bw_ws ON (bw_we.session_id = bw_ws.id AND bw_ws.status = 'completed'))
      WHERE (bw_we.exercise_id = e.id AND bw_s.weight IS NOT NULL)
      ORDER BY
        CASE WHEN lower(e.name) LIKE 'assisted %' THEN bw_s.weight END ASC NULLS LAST,
        CASE WHEN lower(e.name) NOT LIKE 'assisted %' THEN bw_s.weight END DESC NULLS LAST,
        bw_s.reps DESC NULLS LAST,
        bw_s.set_number DESC
      LIMIT 1
    ) AS best_weight_set
  FROM (((exercises e
    LEFT JOIN workout_exercises we ON (we.exercise_id = e.id))
    LEFT JOIN workout_sessions ws ON (we.session_id = ws.id AND ws.status = 'completed'))
    LEFT JOIN workout_sets s ON (s.workout_exercise_id = we.id AND ws.id IS NOT NULL))
 GROUP BY e.id, e.name, e.category, e.current_working;

-- exercise_recent_trend: exclude planned sessions from trend window and results
DROP VIEW IF EXISTS exercise_recent_trend;
CREATE VIEW exercise_recent_trend WITH (security_invoker = true) AS
SELECT e.id AS exercise_id,
    e.name,
    ws.date,
    ws.id AS session_id,
    json_agg(json_build_object('set_number', s.set_number, 'reps', s.reps, 'weight', s.weight, 'weight_unit', s.weight_unit, 'duration_seconds', s.duration_seconds, 'is_pr', s.is_pr, 'notes', s.notes) ORDER BY s.set_number) AS sets
   FROM (((exercises e
     JOIN workout_exercises we ON (we.exercise_id = e.id))
     JOIN workout_sessions ws ON (we.session_id = ws.id AND ws.status = 'completed'))
     LEFT JOIN workout_sets s ON (s.workout_exercise_id = we.id))
  WHERE (ws.date >= ( SELECT COALESCE(( SELECT ws2.date
                   FROM (workout_exercises we2
                     JOIN workout_sessions ws2 ON (we2.session_id = ws2.id AND ws2.status = 'completed'))
                  WHERE (we2.exercise_id = e.id)
                  ORDER BY ws2.date DESC
                 OFFSET 3
                 LIMIT 1), '1970-01-01'::date)))
  GROUP BY e.id, e.name, ws.date, ws.id
  ORDER BY e.name, ws.date DESC;
