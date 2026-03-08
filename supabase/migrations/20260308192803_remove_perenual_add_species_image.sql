-- Remove Perenual API columns from plants (data now comes from species_profiles)
ALTER TABLE plants
  DROP COLUMN IF EXISTS perenual_id,
  DROP COLUMN IF EXISTS api_watering,
  DROP COLUMN IF EXISTS api_sunlight;

-- Remove perenual_id from species_profiles and add image_url
ALTER TABLE species_profiles
  DROP COLUMN IF EXISTS perenual_id;

ALTER TABLE species_profiles
  ADD COLUMN IF NOT EXISTS image_url text;
