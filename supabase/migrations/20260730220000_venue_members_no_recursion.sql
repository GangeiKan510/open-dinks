-- venue_members policies must not SELECT venue_members under RLS.
-- The FOR ALL "Owners can manage" policy used EXISTS (SELECT FROM venue_members),
-- which retriggers the same policies (42P17 infinite recursion) on first insert.

create or replace function public.is_venue_member(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.venue_members
    where venue_id = p_venue_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_venue_manager(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.venue_members
    where venue_id = p_venue_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_venue_member(uuid) to authenticated;
grant execute on function public.is_venue_manager(uuid) to authenticated;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'venue_members'
  loop
    execute format('drop policy if exists %I on public.venue_members', pol.policyname);
  end loop;
end $$;

create policy "Members can view venue_members"
  on public.venue_members for select to authenticated
  using (user_id = auth.uid());

create policy "Users can insert themselves as venue member"
  on public.venue_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "Managers can add venue_members"
  on public.venue_members for insert to authenticated
  with check (public.is_venue_manager(venue_id));

create policy "Managers can update venue_members"
  on public.venue_members for update to authenticated
  using (public.is_venue_manager(venue_id))
  with check (public.is_venue_manager(venue_id));

create policy "Managers can delete venue_members"
  on public.venue_members for delete to authenticated
  using (public.is_venue_manager(venue_id));
