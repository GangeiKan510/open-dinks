-- Public booking uses Google sign-in. Those accounts may request a court.
-- They must not create a facility or attach themselves to someone else's venue.
-- Email host accounts, and anyone who already belongs to a venue, still can.

create or replace function public.is_host_account()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') is distinct from 'google'
    or coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'email';
$$;

create or replace function public.created_venue(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.venues
    where id = p_venue_id
      and created_by = auth.uid()
  );
$$;

grant execute on function public.is_host_account() to authenticated;
grant execute on function public.created_venue(uuid) to authenticated;

drop policy if exists "Authenticated can create facilities" on public.facilities;
create policy "Authenticated can create facilities"
  on public.facilities for insert to authenticated
  with check (public.is_host_account());

drop policy if exists "Authenticated can create venues" on public.venues;
create policy "Authenticated can create venues"
  on public.venues for insert to authenticated
  with check (created_by = auth.uid() and public.is_host_account());

drop policy if exists "Users can insert themselves as venue member" on public.venue_members;
create policy "Users can insert themselves as venue member"
  on public.venue_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_host_account()
    and public.created_venue(venue_id)
  );

drop policy if exists "Directors manage own tournaments" on public.tournaments;
create policy "Directors manage own tournaments"
  on public.tournaments for all to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and (
      public.is_host_account()
      or exists (
        select 1
        from public.venue_members
        where user_id = auth.uid()
      )
    )
  );
