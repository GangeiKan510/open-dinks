-- Repair RLS/grants so first-venue bootstrap can succeed.
--
-- Audit of write paths vs policies:
--   profiles          upsert + select     SELECT true, INSERT/UPDATE own id
--   facilities        insert + select id  public SELECT, authenticated INSERT
--   venues            insert + select id  INSERT created_by = uid, but SELECT was
--                                         members-only — INSERT...RETURNING failed
--   venue_members     insert              self-insert + owner ALL; SELECT was
--                                         members-only (chicken/egg on first row)
--   courts / players  insert after member members ALL
--   sessions          insert + select     members ALL + public SELECT by status
--   session_players   insert + select     members ALL + public read/check-in
--   matches           insert/update/delete members ALL + public SELECT
--   pairing_history   upsert              members ALL + public SELECT
--   session_events    insert              members ALL

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.courts enable row level security;
alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.matches enable row level security;
alter table public.pairing_history enable row level security;
alter table public.session_events enable row level security;
alter table public.facilities enable row level security;

-- Venues: creator must be able to RETURNING the row before membership exists.
drop policy if exists "Members can view venues" on public.venues;
create policy "Members can view venues"
  on public.venues for select to authenticated
  using (public.is_venue_member(id) or created_by = auth.uid());

drop policy if exists "Authenticated can create venues" on public.venues;
create policy "Authenticated can create venues"
  on public.venues for insert to authenticated
  with check (created_by = auth.uid());

-- Venue members: own rows only (avoid RLS recursion via is_venue_member).
drop policy if exists "Members can view venue_members" on public.venue_members;
create policy "Members can view venue_members"
  on public.venue_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert themselves as venue member" on public.venue_members;
create policy "Users can insert themselves as venue member"
  on public.venue_members for insert to authenticated
  with check (user_id = auth.uid());
