# Plant Care Data Management in Supabase

Instructions for Claude.ai to manage plant care data in Supabase (project ID: `svmjtlsdyghxilpcdywc`) using `Supabase:execute_sql`. The web app at kyleacmooney.github.io/apps/#/plants reads this data for care scheduling, plant detail views, and the to-do dashboard.

## Schema Overview

### `rooms` — where plants live

- `id` (uuid PK), `user_id` (uuid FK), `name` (text), `created_at` (timestamptz)

### `plants` — individual plant instances

- `id` (uuid PK), `user_id` (uuid FK), `room_id` (uuid FK to rooms, nullable)
- `nickname` (text), `species_common_name` (text), `species_scientific_name` (text, nullable)
- `perenual_id` (integer, nullable — from Perenual API), `species_thumbnail_url` (text, nullable)
- `api_watering` (text: 'frequent'/'average'/'minimum'/'none'), `api_sunlight` (text[])
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

### `species_profiles` — researched species data (Claude.ai primary write target)

- `id` (uuid PK), `user_id` (uuid FK)
- `perenual_id` (integer, nullable), `species_common_name` (text), `species_scientific_name` (text, nullable)
- **Algorithm-relevant fields** (affect watering/care schedule computation):
  - `watering_interval_days` (integer — researched precise base interval in days; overrides the Perenual API default)
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

This is the primary Claude.ai workflow. When the user asks about a plant species:

1. Check if a profile already exists:
```sql
SELECT * FROM species_profiles WHERE species_common_name = 'Monstera Deliciosa';
```

2. If it exists, UPDATE the relevant fields. If not, INSERT:
```sql
INSERT INTO species_profiles (
  user_id, species_common_name, species_scientific_name,
  watering_interval_days, humidity_preference, temperature_min_f, temperature_max_f,
  dormancy_months, fertilize_interval_days, misting_needed,
  care_summary, common_problems, propagation_tips, seasonal_care_notes, fun_facts,
  updated_at
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Monstera Deliciosa', 'Monstera deliciosa',
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

### Update a specific plant's notes

When advice is specific to a plant instance (not the species in general):

```sql
UPDATE plants SET notes = 'Showing signs of root rot — repotted on 2026-03-08 into fresh soil with extra perlite. Monitor for 2 weeks before resuming normal watering.', updated_at = now()
WHERE nickname = 'Big Monstera';
```

### Adjust a care schedule based on research

If research reveals a plant needs more/less frequent care:

```sql
UPDATE care_schedules
SET interval_days = 5, is_custom = true, updated_at = now()
WHERE plant_id = (SELECT id FROM plants WHERE nickname = 'Big Monstera')
  AND care_type = 'water';
```

### Query the user's collection

```sql
-- All active plants with their rooms
SELECT p.nickname, p.species_common_name, r.name as room, p.pot_material, p.pot_size, p.light_level
FROM plants p LEFT JOIN rooms r ON p.room_id = r.id
WHERE p.is_archived = false
ORDER BY r.name, p.nickname;

-- Upcoming care tasks
SELECT cs.care_type, cs.next_due, cs.interval_days, p.nickname
FROM care_schedules cs JOIN plants p ON cs.plant_id = p.id
WHERE cs.is_enabled = true AND p.is_archived = false
ORDER BY cs.next_due;

-- Care history for a specific plant
SELECT cl.care_type, cl.status, cl.performed_at, cl.notes
FROM care_logs cl JOIN plants p ON cl.plant_id = p.id
WHERE p.nickname = 'Big Monstera'
ORDER BY cl.performed_at DESC LIMIT 20;
```

### Log a care action (if the user reports doing something outside the app)

```sql
DO $$ DECLARE v_plant_id uuid; v_interval integer; BEGIN
  SELECT id INTO v_plant_id FROM plants WHERE nickname = 'Big Monstera';

  INSERT INTO care_logs (user_id, plant_id, care_type, status, notes)
  VALUES ((SELECT id FROM auth.users LIMIT 1), v_plant_id, 'water', 'done', 'Watered thoroughly, good drainage');

  SELECT interval_days INTO v_interval FROM care_schedules WHERE plant_id = v_plant_id AND care_type = 'water';

  UPDATE care_schedules SET next_due = CURRENT_DATE + v_interval, updated_at = now()
  WHERE plant_id = v_plant_id AND care_type = 'water';
END $$;
```

## Rules

- Always use `(SELECT id FROM auth.users LIMIT 1)` for `user_id` — there's only one user
- Always use year 2026 for dates
- When researching species, populate ALL informative fields (`care_summary`, `common_problems`, `propagation_tips`, `seasonal_care_notes`, `fun_facts`) — the plant detail view displays them
- For `watering_interval_days`, research the actual recommended frequency for indoor conditions and convert to days (e.g., "water every 7-10 days" → 8)
- `dormancy_months` uses 1-indexed months: January=1, December=12
- When updating `care_schedules`, always set `is_custom = true` to indicate the interval was manually/research-adjusted
- After updating `next_due` on a care schedule, the change appears immediately in the app's To-Do tab
- Check existing data before inserting to avoid duplicates — use `ON CONFLICT` for `species_profiles`
- Keep `care_summary` concise (2-3 sentences), other fields can be longer
- Temperature values are in Fahrenheit
