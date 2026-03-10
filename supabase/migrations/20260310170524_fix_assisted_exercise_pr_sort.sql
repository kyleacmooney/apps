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
          JOIN workout_exercises pr_we ON ((pr_s.workout_exercise_id = pr_we.id)))
          JOIN workout_sessions pr_ws ON ((pr_we.session_id = pr_ws.id))
      )
      WHERE ((pr_we.exercise_id = e.id) AND (pr_s.is_pr = true))
      ORDER BY
        pr_ws.date DESC,
        CASE
          WHEN lower(e.name) LIKE 'assisted %' THEN pr_s.weight
        END ASC NULLS LAST,
        CASE
          WHEN lower(e.name) NOT LIKE 'assisted %' THEN pr_s.weight
        END DESC NULLS LAST,
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
        JOIN workout_exercises bw_we ON ((bw_s.workout_exercise_id = bw_we.id)))
      WHERE ((bw_we.exercise_id = e.id) AND (bw_s.weight IS NOT NULL))
      ORDER BY
        CASE
          WHEN lower(e.name) LIKE 'assisted %' THEN bw_s.weight
        END ASC NULLS LAST,
        CASE
          WHEN lower(e.name) NOT LIKE 'assisted %' THEN bw_s.weight
        END DESC NULLS LAST,
        bw_s.reps DESC NULLS LAST,
        bw_s.set_number DESC
      LIMIT 1
    ) AS best_weight_set
  FROM (((exercises e
    LEFT JOIN workout_exercises we ON ((we.exercise_id = e.id)))
    LEFT JOIN workout_sessions ws ON ((we.session_id = ws.id)))
    LEFT JOIN workout_sets s ON ((s.workout_exercise_id = we.id)))
 GROUP BY e.id, e.name, e.category, e.current_working;
