-- Add installed_apps column to user_settings
-- NULL means the user has never customized their app list (show all apps)
-- An array value means only those app slugs are shown on the home screen
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS installed_apps jsonb;
