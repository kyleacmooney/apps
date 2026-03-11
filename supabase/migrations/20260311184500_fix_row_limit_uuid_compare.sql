-- Fix row-limit trigger comparisons for UUID-scoped tables.
-- The original function extracted NEW.<scope_col> as text and then compared it
-- against the raw column type, which fails for uuid columns during INSERTs.
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
    'SELECT count(*)::integer FROM %I.%I WHERE %I::text = $1',
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
