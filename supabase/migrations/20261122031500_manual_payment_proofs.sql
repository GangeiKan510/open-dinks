-- GCash receipts. PayMongo tables stay. A plan opens only after an operator
-- approves the receipt. Hosts can read their own rows. Writes use the service role.

create table if not exists public.manual_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  submitted_by uuid not null,
  kind text not null check (kind in ('club', 'day')),
  amount_centavos integer not null check (amount_centavos > 0),
  discount_code text,
  dates text,
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists manual_payment_proofs_one_pending
  on public.manual_payment_proofs (facility_id, kind, coalesce(dates, ''))
  where status = 'pending';

create index if not exists manual_payment_proofs_status_idx
  on public.manual_payment_proofs (status, created_at);

alter table public.manual_payment_proofs enable row level security;

drop policy if exists "Hosts read their payment proofs" on public.manual_payment_proofs;
create policy "Hosts read their payment proofs"
  on public.manual_payment_proofs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.venue_members vm
      join public.venues v on v.id = vm.venue_id
      where v.facility_id = manual_payment_proofs.facility_id
        and vm.user_id = auth.uid()
        and vm.role in ('owner', 'admin')
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
