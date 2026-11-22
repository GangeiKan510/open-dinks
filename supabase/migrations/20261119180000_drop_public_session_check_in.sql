-- Players no longer add themselves. The host console is the only check-in
-- path, so a public insert into a live session is closed. Public reads stay.

drop policy if exists "Public can self check-in to live sessions"
  on public.session_players;

-- Court names on the public session page. Limited to venues with a live
-- session so an idle club's court list stays member-only.
drop policy if exists "Public can read courts during live open play"
  on public.courts;
create policy "Public can read courts during live open play"
  on public.courts for select to anon, authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.venue_id = courts.venue_id
        and s.status = 'live'
    )
  );
