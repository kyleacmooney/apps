-- Store per-user external Supabase configuration
-- so users can bring their own backend
CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  external_supabase_url text,
  external_supabase_anon_key text,
  setup_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Owner-only CRUD: each user can only read/write their own settings
CREATE POLICY "user_settings: owner select" ON user_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_settings: owner insert" ON user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_settings: owner update" ON user_settings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_settings: owner delete" ON user_settings
  FOR DELETE USING (user_id = auth.uid());

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();
