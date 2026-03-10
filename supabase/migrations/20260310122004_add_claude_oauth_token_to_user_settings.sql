ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS claude_oauth_token text;
