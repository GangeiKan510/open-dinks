-- Court timers: max game minutes + ready match status

alter table public.sessions
  add column if not exists max_game_minutes int not null default 15
  check (max_game_minutes between 1 and 60);

alter type public.match_status add value if not exists 'ready' before 'active';

alter table public.matches
  alter column started_at drop not null;

alter table public.matches
  alter column started_at set default null;
