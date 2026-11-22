-- Hosts can read their own confirmed payments for the history tab.
-- Inserts stay on the service role.

drop policy if exists "Owners read their payments" on public.paymongo_payments;
create policy "Owners read their payments"
  on public.paymongo_payments for select to authenticated
  using (
    exists (
      select 1
      from public.venues v
      join public.venue_members vm on vm.venue_id = v.id
      where v.facility_id = paymongo_payments.facility_id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
  );

grant select on public.paymongo_payments to authenticated;
