# Managing Watchlist, Todos & Interests in Supabase

Instructions for Claude.ai to manage watchlist items, todos, and interests in Supabase (project ID: `svmjtlsdyghxilpcdywc`) using `Supabase:execute_sql`. The web app at kyleacmooney.github.io/apps reads this data.

## Multi-user context

- The database is multi-user. Always include `user_id` when inserting into any table.
- Get the current user's ID with `auth.uid()` in RLS-enabled queries, or look up by email: `SELECT id FROM auth.users WHERE email = '<user_email>'`
- Always scope queries by user when updating or querying by title/content.

---

## Watchlist

Tracks movies and shows with a status and optional rating.

### Schema

**`watchlist`** table:
- `id` (uuid PK, default gen_random_uuid())
- `user_id` (uuid FK to auth.users, NOT NULL)
- `title` (text, NOT NULL)
- `media_type` (text: `'movie'` | `'show'`, default `'movie'`)
- `status` (text: `'want'` | `'watching'` | `'watched'`, default `'want'`)
- `rating` (integer 1–10, nullable — only set after watching)
- `notes` (text, nullable — personal impressions, context, where to watch)
- `tags` (text[], default `{}` — e.g. `{thriller, sci-fi, based-on-book}`)
- `year` (integer, nullable — release year)
- `created_at` / `updated_at` (timestamptz)

### Status values

- `want` — want to watch
- `watching` — currently watching (useful for multi-episode shows)
- `watched` — finished watching

### Common operations

**Add a new item:**
```sql
INSERT INTO watchlist (user_id, title, media_type, status, notes, tags, year)
VALUES (auth.uid(), 'Severance', 'show', 'want', 'Highly recommended by several people', ARRAY['thriller', 'sci-fi', 'work'], 2022);
```

**Mark as watched with a rating:**
```sql
UPDATE watchlist
SET status = 'watched', rating = 9, notes = 'Incredible tension and world-building', updated_at = now()
WHERE title = 'Severance' AND user_id = auth.uid();
```

**Update status (e.g., start watching):**
```sql
UPDATE watchlist
SET status = 'watching', updated_at = now()
WHERE title = 'Severance' AND user_id = auth.uid();
```

**Add multiple items at once:**
```sql
INSERT INTO watchlist (user_id, title, media_type, status, year)
VALUES
  (auth.uid(), 'Dune: Part Two', 'movie', 'want', 2024),
  (auth.uid(), 'The Bear', 'show', 'want', 2022),
  (auth.uid(), 'Past Lives', 'movie', 'want', 2023);
```

**Delete an item:**
```sql
DELETE FROM watchlist WHERE title = 'Some Movie' AND user_id = auth.uid();
```

**View current watchlist:**
```sql
SELECT title, media_type, status, rating, year, tags
FROM watchlist
WHERE user_id = auth.uid()
ORDER BY
  CASE status WHEN 'watching' THEN 0 WHEN 'want' THEN 1 WHEN 'watched' THEN 2 END,
  created_at DESC;
```

### Rules

- Only set `rating` on `watched` items
- `tags` should be lowercase, hyphenated for multi-word (e.g. `based-on-book`, `true-crime`)
- Don't duplicate entries — check first: `SELECT id FROM watchlist WHERE title ILIKE '%...' AND user_id = auth.uid()`

---

## Todos

Daily life task manager with categories, priorities, and recurring support.

### Schema

**`todos`** table:
- `id` (uuid PK, default gen_random_uuid())
- `user_id` (uuid FK to auth.users, NOT NULL)
- `title` (text, NOT NULL)
- `description` (text, nullable — additional context or steps)
- `due_date` (date, nullable — use YYYY-MM-DD format)
- `priority` (text: `'low'` | `'medium'` | `'high'` | `'urgent'`, default `'medium'`)
- `status` (text: `'pending'` | `'done'` | `'recurring'`, default `'pending'`)
- `category` (text: `'errands'` | `'health'` | `'admin'` | `'home'` | `'work'` | `'personal'`, default `'personal'`)
- `recurring_interval` (text: `'daily'` | `'weekly'` | `'monthly'`, nullable — only for recurring todos)
- `created_at` / `updated_at` (timestamptz)
- `completed_at` (timestamptz, nullable — set when status becomes `'done'`)

### Category guide

- `errands` — shopping, pickups, deliveries, errands outside the home
- `health` — medical appointments, medications, fitness, wellness
- `admin` — paperwork, bills, finances, registrations, government tasks
- `home` — cleaning, repairs, maintenance, household tasks
- `work` — work tasks, deadlines, professional obligations
- `personal` — personal goals, relationships, hobbies, miscellaneous

### Common operations

**Add a todo:**
```sql
INSERT INTO todos (user_id, title, description, due_date, priority, category)
VALUES (auth.uid(), 'Schedule dentist appointment', NULL, '2026-03-20', 'medium', 'health');
```

**Add a recurring todo:**
```sql
INSERT INTO todos (user_id, title, priority, category, status, recurring_interval)
VALUES (auth.uid(), 'Take out trash', 'medium', 'home', 'recurring', 'weekly');
```

**Mark as done:**
```sql
UPDATE todos
SET status = 'done', completed_at = now(), updated_at = now()
WHERE title = 'Schedule dentist appointment' AND user_id = auth.uid() AND status = 'pending';
```

**Add multiple todos at once:**
```sql
INSERT INTO todos (user_id, title, priority, category, due_date)
VALUES
  (auth.uid(), 'Renew car registration', 'high', 'admin', '2026-04-01'),
  (auth.uid(), 'Buy birthday gift for Mom', 'high', 'personal', '2026-03-25'),
  (auth.uid(), 'Clean bathroom', 'low', 'home', NULL);
```

**View active todos:**
```sql
SELECT title, category, priority, due_date, status
FROM todos
WHERE user_id = auth.uid() AND status != 'done'
ORDER BY
  CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
  due_date NULLS LAST,
  created_at DESC;
```

### Rules

- Always use current year 2026 for dates
- `completed_at` must be set when marking status `'done'`; set to NULL when un-completing
- Recurring todos have `status = 'recurring'` and a non-null `recurring_interval` — never mark them as `'done'`
- Check for duplicates before adding: `SELECT id FROM todos WHERE title ILIKE '%...' AND status != 'done' AND user_id = auth.uid()`

---

## Interests

Personal knowledge queue — books, papers, topics, tools, courses, and rabbit holes to explore.

### Schema

**`interests`** table:
- `id` (uuid PK, default gen_random_uuid())
- `user_id` (uuid FK to auth.users, NOT NULL)
- `title` (text, NOT NULL — book title, paper name, topic, tool name, etc.)
- `url` (text, nullable — link to paper, article, documentation, etc.)
- `notes` (text, nullable — why it's interesting, context, recommendations)
- `category` (text: `'book'` | `'paper'` | `'math'` | `'ml'` | `'alignment'` | `'tool'` | `'course'` | `'other'`, default `'other'`)
- `status` (text: `'not_started'` | `'in_progress'` | `'done'` | `'parked'`, default `'not_started'`)
- `tags` (text[], default `{}` — e.g. `{reinforcement-learning, interpretability}`)
- `priority` (integer 1–5, default 3 — 5 is highest)
- `created_at` / `updated_at` (timestamptz)

### Category guide

- `book` — books (technical, non-fiction, fiction worth tracking)
- `paper` — academic papers, preprints, blog posts that read like papers
- `math` — mathematical topics, theorems, proofs to understand
- `ml` — machine learning topics, architectures, techniques
- `alignment` — AI alignment, safety, interpretability research
- `tool` — software tools, libraries, frameworks, services to try
- `course` — online courses, lecture series, tutorials
- `other` — anything that doesn't fit the above

### Status values

- `not_started` — queued but not started
- `in_progress` — currently reading/learning/exploring
- `done` — finished
- `parked` — paused, deprioritized, or waiting for the right time

### Common operations

**Add an interest:**
```sql
INSERT INTO interests (user_id, title, url, notes, category, status, priority, tags)
VALUES (
  auth.uid(),
  'Attention Is All You Need',
  'https://arxiv.org/abs/1706.03762',
  'The original transformer paper — foundational reading',
  'paper',
  'not_started',
  4,
  ARRAY['transformers', 'attention', 'nlp']
);
```

**Add multiple interests:**
```sql
INSERT INTO interests (user_id, title, category, status, priority, notes)
VALUES
  (auth.uid(), 'The Alignment Problem - Brian Christian', 'book', 'not_started', 4, 'Recommended by multiple people in the field'),
  (auth.uid(), 'Anthropic Interpretability Research', 'alignment', 'not_started', 5, 'Follow ongoing work on mechanistic interpretability'),
  (auth.uid(), 'Lean theorem prover', 'tool', 'not_started', 3, 'For formalizing math proofs');
```

**Update status (start reading):**
```sql
UPDATE interests
SET status = 'in_progress', updated_at = now()
WHERE title ILIKE '%Attention Is All You Need%' AND user_id = auth.uid();
```

**Mark as done:**
```sql
UPDATE interests
SET status = 'done', updated_at = now()
WHERE title ILIKE '%Attention Is All You Need%' AND user_id = auth.uid();
```

**Park an item (deprioritize):**
```sql
UPDATE interests
SET status = 'parked', updated_at = now()
WHERE title ILIKE '%...' AND user_id = auth.uid();
```

**View active interests:**
```sql
SELECT title, category, status, priority, url
FROM interests
WHERE user_id = auth.uid() AND status NOT IN ('done', 'parked')
ORDER BY priority DESC, created_at DESC;
```

### Rules

- Always use current year 2026 for reference
- `tags` should be lowercase, hyphenated for multi-word (e.g. `reinforcement-learning`, `large-language-models`)
- `priority` 5 = most urgent/important, 1 = lowest
- Check for duplicates before adding: `SELECT id FROM interests WHERE title ILIKE '%...' AND user_id = auth.uid()`
- Add a `url` whenever there's a canonical link (paper URL, book page, tool homepage, course page)
