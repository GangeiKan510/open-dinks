-- Signups before the auth trigger existed (or upsert fallback) need insert access.
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());
