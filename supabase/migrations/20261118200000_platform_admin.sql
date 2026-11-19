-- Operator accounts, anonymous feedback, and the centavos recorded on a payment.
-- Operators read the panel through the service role. A signed-in operator can
-- only see their own roster row, which is enough to lock them to /admin.
-- Feedback stores no account. Featured rows are the only public read.

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists platform_admins_select_self on public.platform_admins;
create policy platform_admins_select_self
  on public.platform_admins
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.platform_admins from anon;
grant select on table public.platform_admins to authenticated;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  rating smallint,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  constraint feedback_body_length check (char_length(btrim(body)) between 8 and 2000),
  constraint feedback_rating_range check (rating is null or rating between 1 and 5)
);

create index if not exists feedback_created_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert_public on public.feedback;
create policy feedback_insert_public
  on public.feedback
  for insert
  to anon, authenticated
  with check (
    featured = false
    and char_length(btrim(body)) between 8 and 2000
    and (rating is null or rating between 1 and 5)
  );

revoke all on table public.feedback from anon, authenticated;
grant insert on table public.feedback to anon, authenticated;

create or replace function public.featured_feedback()
returns table (
  id uuid,
  body text,
  rating smallint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.body, f.rating, f.created_at
  from public.feedback f
  where f.featured
  order by f.created_at desc
  limit 12;
$$;

revoke all on function public.featured_feedback() from public;
grant execute on function public.featured_feedback() to anon, authenticated;

alter table public.paymongo_payments
  add column if not exists amount_centavos integer;

update public.paymongo_payments
set amount_centavos = case kind
  when 'club' then 69900
  when 'day' then 150000
  when 'weekend' then 400000
end
where amount_centavos is null;
