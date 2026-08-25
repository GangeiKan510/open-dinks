-- Court timers: max game minutes + ready match status

alter table public.sessions
  add column if not exists max_game_minutes int not null default 15;

do $$
begin
  alter table public.sessions
    add constraint sessions_max_game_minutes_check
    check (max_game_minutes between 1 and 60);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.match_status add value if not exists 'ready' before 'active';
exception
  when others then null;
end $$;

alter table public.matches
  alter column started_at drop not null;

alter table public.matches
  alter column started_at set default null;
