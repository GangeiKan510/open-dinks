-- The amount paid stays in amount_centavos. list_centavos is the price
-- before the discount, so history can show the breakdown later even if the
-- code's percent changes.

alter table public.manual_payment_proofs
  add column if not exists list_centavos integer;

alter table public.manual_payment_proofs
  drop constraint if exists manual_payment_proofs_list_centavos_check;

alter table public.manual_payment_proofs
  add constraint manual_payment_proofs_list_centavos_check
  check (list_centavos is null or list_centavos > 0);

update public.manual_payment_proofs as proof
set list_centavos = candidate.list_centavos
from (
  select
    p.id,
    case
      when c.percent_off is not null then
        p.amount_centavos + round(
          p.amount_centavos::numeric * c.percent_off / (100 - c.percent_off)
        )::integer
      else p.amount_centavos + c.amount_off_centavos
    end as list_centavos,
    c.percent_off,
    c.amount_off_centavos
  from public.manual_payment_proofs p
  join public.discount_codes c on c.code = p.discount_code
  where p.discount_code is not null
    and p.list_centavos is null
) as candidate
where proof.id = candidate.id
  and candidate.list_centavos > proof.amount_centavos
  and (
    (
      candidate.percent_off is not null
      and round(candidate.list_centavos::numeric * candidate.percent_off / 100)::integer
        = candidate.list_centavos - proof.amount_centavos
    )
    or (
      candidate.amount_off_centavos is not null
      and candidate.amount_off_centavos = candidate.list_centavos - proof.amount_centavos
    )
  );
