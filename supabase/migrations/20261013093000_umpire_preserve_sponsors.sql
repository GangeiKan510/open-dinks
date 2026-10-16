-- Umpire phones save the whole tournament document. A phone that loaded
-- before logos were added replaces the row and drops the sponsor list.
-- Scoring keeps the sponsors and clubs already stored on the row.

create or replace function public.umpire_save_tournament(
  p_token text,
  p_document jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'umpire token is required';
  end if;
  if p_document is null
     or jsonb_typeof(p_document) <> 'object'
     or not (p_document ? 'categories') then
    raise exception 'tournament document is invalid';
  end if;

  update public.tournaments as tournament
  set document = p_document
    || case
      when tournament.document ? 'sponsors'
        then jsonb_build_object('sponsors', tournament.document->'sponsors')
      else '{}'::jsonb
    end
    || case
      when tournament.document ? 'clubs'
        then jsonb_build_object('clubs', tournament.document->'clubs')
      else '{}'::jsonb
    end
  from public.tournament_umpire_links as link
  where link.token = p_token
    and tournament.id = link.tournament_id
  returning tournament.id into updated_id;

  if updated_id is null then
    raise exception 'umpire link was not found';
  end if;
end;
$$;
