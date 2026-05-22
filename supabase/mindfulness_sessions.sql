-- Mindfulness sessions: track time spent on language study, bible study, mental health
-- Apply once in Supabase SQL editor.

create table if not exists public.mindfulness_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  category text not null check (category in ('language', 'bible', 'mental_health')),
  duration integer not null check (duration >= 0), -- minutes
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists mindfulness_sessions_user_date_idx
  on public.mindfulness_sessions (user_id, date desc);

alter table public.mindfulness_sessions enable row level security;

create policy "Users can view their own mindfulness sessions"
  on public.mindfulness_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own mindfulness sessions"
  on public.mindfulness_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own mindfulness sessions"
  on public.mindfulness_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own mindfulness sessions"
  on public.mindfulness_sessions for delete
  using (auth.uid() = user_id);
