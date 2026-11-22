-- Host dashboards subscribe to these rows. Approving a receipt then
-- closes the plan dialog on the open host page.

alter table public.facility_billing replica identity full;
alter table public.tournament_passes replica identity full;
alter table public.manual_payment_proofs replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'facility_billing'
  ) then
    alter publication supabase_realtime add table public.facility_billing;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournament_passes'
  ) then
    alter publication supabase_realtime add table public.tournament_passes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'manual_payment_proofs'
  ) then
    alter publication supabase_realtime add table public.manual_payment_proofs;
  end if;
end $$;
