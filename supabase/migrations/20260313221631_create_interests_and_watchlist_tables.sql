-- ============================================================
-- interests — personal knowledge queue / reading list
-- ============================================================
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text,
  notes text,
  category text not null default 'other' check (category in ('book', 'paper', 'math', 'ml', 'alignment', 'tool', 'course', 'other')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done', 'parked')),
  tags text[] not null default '{}',
  priority integer not null default 3 check (priority >= 1 and priority <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interests enable row level security;

create policy "Users can view their own interests"
  on public.interests for select using (auth.uid() = user_id);
create policy "Users can insert their own interests"
  on public.interests for insert with check (auth.uid() = user_id);
create policy "Users can update their own interests"
  on public.interests for update using (auth.uid() = user_id);
create policy "Users can delete their own interests"
  on public.interests for delete using (auth.uid() = user_id);

create index interests_user_id_idx on public.interests(user_id);
create index interests_status_idx on public.interests(user_id, status);
create index interests_category_idx on public.interests(user_id, category);

CREATE TRIGGER enforce_interests_limit
  BEFORE INSERT ON interests
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('2000', 'user_id');

-- ============================================================
-- watchlist — movies and shows tracker
-- ============================================================
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  media_type text not null default 'movie' check (media_type in ('movie', 'show')),
  status text not null default 'want' check (status in ('want', 'watching', 'watched')),
  rating integer check (rating >= 1 and rating <= 10),
  notes text,
  tags text[] not null default '{}',
  year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watchlist enable row level security;

create policy "Users can view their own watchlist"
  on public.watchlist for select using (auth.uid() = user_id);
create policy "Users can insert their own watchlist items"
  on public.watchlist for insert with check (auth.uid() = user_id);
create policy "Users can update their own watchlist items"
  on public.watchlist for update using (auth.uid() = user_id);
create policy "Users can delete their own watchlist items"
  on public.watchlist for delete using (auth.uid() = user_id);

create index watchlist_user_id_idx on public.watchlist(user_id);
create index watchlist_status_idx on public.watchlist(user_id, status);
create index watchlist_type_idx on public.watchlist(user_id, media_type);

CREATE TRIGGER enforce_watchlist_limit
  BEFORE INSERT ON watchlist
  FOR EACH ROW EXECUTE FUNCTION enforce_row_limit('2000', 'user_id');
