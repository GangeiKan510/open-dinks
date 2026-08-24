alter table public.sessions
  add constraint sessions_court_count_min check (court_count >= 1);
