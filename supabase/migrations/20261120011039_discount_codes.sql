-- Host discount codes. Operators manage them through the service role.
-- Hosts never read this table. A redemption is written only after PayMongo is paid.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  applies_to text not null,
  percent_off integer,
  amount_off_centavos integer,
  active boolean not null default true,
  expires_on date,
  max_redemptions integer,
  created_at timestamptz not null default now(),
  constraint discount_codes_code_unique unique (code),
  constraint discount_codes_code_shape check (code ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
  constraint discount_codes_applies_to check (applies_to in ('club', 'day', 'any')),
  constraint discount_codes_one_value check (
    (
      percent_off is not null
      and amount_off_centavos is null
      and percent_off between 1 and 99
    )
    or (
      amount_off_centavos is not null
      and percent_off is null
      and amount_off_centavos > 0
    )
  ),
  constraint discount_codes_max check (
    max_redemptions is null or max_redemptions > 0
  )
);

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.discount_codes (id),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  checkout_id text not null,
  created_at timestamptz not null default now(),
  constraint discount_redemptions_checkout_unique unique (checkout_id)
);

create index if not exists discount_redemptions_code_idx
  on public.discount_redemptions (code_id);

alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;

revoke all on table public.discount_codes from anon, authenticated;
revoke all on table public.discount_redemptions from anon, authenticated;
