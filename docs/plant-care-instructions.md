# Plant Care Data Management in Supabase

Instructions for Claude.ai to manage plant care data in Supabase (project ID: `svmjtlsdyghxilpcdywc`) using `Supabase:execute_sql`. The web app at kyleacmooney.github.io/apps/#/plants reads this data for care scheduling, plant detail views, and the to-do dashboard.

## Multi-user context

- The database is multi-user. Always include `user_id` when inserting into any plant-related table.
- Get the current user's ID with `auth.uid()` in RLS-enabled queries, or look up by email: `SELECT id FROM auth.users WHERE email = '<user_email>'`
- Always scope queries by user when updating or querying by nickname/name to avoid cross-user collisions.

## Schema Overview

### `rooms` — where plants live

- `id` (uuid PK), `user_id` (uuid FK), `name` (text), `created_at` (timestamptz)

### `plants` — individual plant instances

- `id` (uuid PK), `user_id` (uuid FK), `room_id` (uuid FK to rooms, nullable)
- `nickname` (text), `species_common_name` (text), `species_scientific_name` (text, nullable)
- `species_thumbnail_url` (text, nullable — per-plant photo, typically uploaded by user)
- `pot_material` (text: 'terracotta'/'plastic'/'ceramic'/'fabric'/'wood'/'other')
- `pot_size` (text: 'small'/'medium'/'large'/'xlarge')
- `light_level` (text: 'low'/'medium'/'bright'/'full_sun')
- `notes` (text, nullable), `is_archived` (boolean, default false)
- `created_at`/`updated_at` (timestamptz)

### `care_schedules` — per-plant, per-care-type scheduling

- `id` (uuid PK), `user_id` (uuid FK), `plant_id` (uuid FK)
- `care_type` (care_type enum: 'water'/'fertilize'/'mist'/'repot'/'clean'/'prune')
- `interval_days` (integer >= 1), `is_custom` (boolean — true if user/Claude overrode the default)
- `next_due` (date), `is_enabled` (boolean)
- Unique constraint: `(plant_id, care_type)`

### `care_logs` — history of care actions

- `id` (uuid PK), `user_id` (uuid FK), `plant_id` (uuid FK)
- `care_type` (care_type enum), `status` (care_status enum: 'done'/'skipped')
- `performed_at` (timestamptz, default now()), `notes` (text, nullable)

### `species_profiles` — species reference data (Claude.ai primary write target)

This is the **primary source of species information**. Claude.ai creates a profile for each species when the user adds a new plant or asks about a species. The web app uses this data for care schedule computation, plant detail views, and species autocomplete when adding new plants.

- `id` (uuid PK), `user_id` (uuid FK)
- `species_common_name` (text), `species_scientific_name` (text, nullable)
- `image_url` (text, nullable — reference image URL from Wikipedia/Wikimedia Commons)
- **Algorithm-relevant fields** (affect watering/care schedule computation):
  - `watering_interval_days` (integer — researched base watering interval in days)
  - `humidity_preference` (text: 'low'/'average'/'high')
  - `temperature_min_f` / `temperature_max_f` (integer — Fahrenheit)
  - `dormancy_months` (integer[] — months where watering should be reduced, e.g. `{11,12,1,2}`)
  - `fertilize_interval_days` (integer — researched fertilizing frequency)
  - `misting_needed` (boolean — whether this species benefits from misting)
- **Informative fields** (displayed read-only in the plant detail view):
  - `care_summary` (text — 2-3 sentence overview of care needs)
  - `common_problems` (text — pests, diseases, nutrient deficiencies)
  - `propagation_tips` (text — how to propagate this species)
  - `seasonal_care_notes` (text — season-specific guidance)
  - `fun_facts` (text — interesting tidbits about the species)
- `created_at`/`updated_at` (timestamptz)
- Unique constraint: `(user_id, species_common_name)`

## Key Operations

### Research a plant species and create/update its profile

This is the primary Claude.ai workflow. When the user adds a new plant or asks about a species:

1. Check if a profile already exists for this user:
```sql
SELECT * FROM species_profiles WHERE species_common_name ILIKE 'Monstera Deliciosa' AND user_id = auth.uid();
```

2. Research the species and INSERT/UPSERT the profile. Find a good reference image from Wikipedia/Wikimedia Commons (look for a clear photo of the plant, preferably CC-licensed):
```sql
INSERT INTO species_profiles (
  user_id, species_common_name, species_scientific_name, image_url,
  watering_interval_days, humidity_preference, temperature_min_f, temperature_max_f,
  dormancy_months, fertilize_interval_days, misting_needed,
  care_summary, common_problems, propagation_tips, seasonal_care_notes, fun_facts,
  updated_at
) VALUES (
  auth.uid(),
  'Swiss cheese plant', 'Monstera deliciosa',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Monstera_deliciosa_example.jpg/800px-Monstera_deliciosa_example.jpg',
  7, 'high', 65, 85,
  '{12,1,2}', 28, true,
  'Tropical climber that thrives in bright indirect light with consistent moisture. Allow top inch of soil to dry between waterings. Benefits from a moss pole for climbing.',
  'Yellow leaves (overwatering), brown tips (low humidity), no fenestrations (insufficient light). Watch for spider mites and thrips.',
  'Stem cuttings with at least one node and aerial root. Root in water or sphagnum moss. Takes 2-4 weeks to root.',
  'Spring/Summer: Increase watering frequency and fertilize every 2 weeks. Fall/Winter: Reduce watering, stop fertilizing. Can tolerate lower light in winter.',
  'Native to Central American rainforests. The holes in mature leaves (fenestrations) are thought to help the plant withstand heavy rainfall and wind.',
  now()
)
ON CONFLICT (user_id, species_common_name) DO UPDATE SET
  species_scientific_name = EXCLUDED.species_scientific_name,
  image_url = EXCLUDED.image_url,
  watering_interval_days = EXCLUDED.watering_interval_days,
  humidity_preference = EXCLUDED.humidity_preference,
  temperature_min_f = EXCLUDED.temperature_min_f,
  temperature_max_f = EXCLUDED.temperature_max_f,
  dormancy_months = EXCLUDED.dormancy_months,
  fertilize_interval_days = EXCLUDED.fertilize_interval_days,
  misting_needed = EXCLUDED.misting_needed,
  care_summary = EXCLUDED.care_summary,
  common_problems = EXCLUDED.common_problems,
  propagation_tips = EXCLUDED.propagation_tips,
  seasonal_care_notes = EXCLUDED.seasonal_care_notes,
  fun_facts = EXCLUDED.fun_facts,
  updated_at = now();
```

The `image_url` will point to a Wikipedia/Wikimedia Commons URL. The app displays these directly — no additional self-hosting step is needed.

### Update a specific plant's notes

When advice is specific to a plant instance (not the species in general):

```sql
UPDATE plants SET notes = 'Showing signs of root rot — repotted on 2026-03-08 into fresh soil with extra perlite. Monitor for 2 weeks before resuming normal watering.', updated_at = now()
WHERE nickname = 'Big Monstera' AND user_id = auth.uid();
```

### Adjust a care schedule based on research

If research reveals a plant needs more/less frequent care:

```sql
UPDATE care_schedules
SET interval_days = 5, is_custom = true, updated_at = now()
WHERE plant_id = (SELECT id FROM plants WHERE nickname = 'Big Monstera' AND user_id = auth.uid())
  AND care_type = 'water';
```

### Query the user's collection

```sql
-- All active plants with their rooms
SELECT p.nickname, p.species_common_name, r.name as room, p.pot_material, p.pot_size, p.light_level
FROM plants p LEFT JOIN rooms r ON p.room_id = r.id
WHERE p.is_archived = false AND p.user_id = auth.uid()
ORDER BY r.name, p.nickname;

-- Upcoming care tasks
SELECT cs.care_type, cs.next_due, cs.interval_days, p.nickname
FROM care_schedules cs JOIN plants p ON cs.plant_id = p.id
WHERE cs.is_enabled = true AND p.is_archived = false AND cs.user_id = auth.uid()
ORDER BY cs.next_due;

-- Care history for a specific plant
SELECT cl.care_type, cl.status, cl.performed_at, cl.notes
FROM care_logs cl JOIN plants p ON cl.plant_id = p.id
WHERE p.nickname = 'Big Monstera' AND cl.user_id = auth.uid()
ORDER BY cl.performed_at DESC LIMIT 20;
```

### Log a care action (if the user reports doing something outside the app)

```sql
DO $$ DECLARE v_plant_id uuid; v_interval integer; BEGIN
  SELECT id INTO v_plant_id FROM plants WHERE nickname = 'Big Monstera' AND user_id = auth.uid();

  INSERT INTO care_logs (user_id, plant_id, care_type, status, notes)
  VALUES (auth.uid(), v_plant_id, 'water', 'done', 'Watered thoroughly, good drainage');

  SELECT interval_days INTO v_interval FROM care_schedules WHERE plant_id = v_plant_id AND care_type = 'water';

  UPDATE care_schedules SET next_due = CURRENT_DATE + v_interval, updated_at = now()
  WHERE plant_id = v_plant_id AND care_type = 'water';
END $$;
```

## Rules

- Always use `auth.uid()` for `user_id` — the database is multi-user
- Always scope queries by `user_id` when looking up by nickname or name to avoid cross-user collisions
- Always use year 2026 for dates
- **Every plant needs a species profile.** When the user mentions a new plant, proactively create a `species_profiles` entry with researched data and an image URL
- When researching species, populate ALL fields (`care_summary`, `common_problems`, `propagation_tips`, `seasonal_care_notes`, `fun_facts`, `image_url`) — the plant detail view displays them
- For `image_url`, find a clear reference photo from Wikipedia/Wikimedia Commons (CC-licensed)
- For `watering_interval_days`, research the actual recommended frequency for indoor conditions and convert to days (e.g., "water every 7-10 days" → 8)
- `dormancy_months` uses 1-indexed months: January=1, December=12
- When updating `care_schedules`, always set `is_custom = true` to indicate the interval was manually/research-adjusted
- After updating `next_due` on a care schedule, the change appears immediately in the app's To-Do tab
- Check existing data before inserting to avoid duplicates — use `ON CONFLICT` for `species_profiles`
- Keep `care_summary` concise (2-3 sentences), other fields can be longer
- Temperature values are in Fahrenheit
- The `species_common_name` in `species_profiles` must match the `species_common_name` in `plants` for the app to link them — use consistent naming
