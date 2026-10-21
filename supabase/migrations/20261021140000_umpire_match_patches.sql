-- An umpire phone used to save the whole tournament. The phone that wrote
-- last replaced every other court's score. A save now locks the row and
-- writes only the match fields that phone changed.

create or replace function public.umpire_save_match_patches(
  p_token text,
  p_patches jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_document jsonb;
  v_updated timestamptz;
  v_patch jsonb;
  v_set jsonb;
  v_clean jsonb;
  v_key text;
  v_categories jsonb;
  v_matches jsonb;
  v_category_index integer;
  v_match_index integer;
  v_found boolean;
  v_allowed text[] := array[
    'stage',
    'groupId',
    'round',
    'slot',
    'number',
    'courtNumber',
    'teamAId',
    'teamBId',
    'games',
    'status',
    'nextMatchId',
    'nextSlot',
    'loserNextMatchId',
    'loserNextSlot',
    'placement',
    'live',
    'claim'
  ];
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'umpire token is required';
  end if;
  if p_patches is null or jsonb_typeof(p_patches) <> 'array' then
    raise exception 'match patches are invalid';
  end if;
  if jsonb_array_length(p_patches) > 80 then
    raise exception 'too many match patches';
  end if;

  select tournament.id, tournament.document
  into v_id, v_document
  from public.tournaments as tournament
  join public.tournament_umpire_links as link
    on link.tournament_id = tournament.id
  where link.token = p_token
  for update of tournament;

  if v_id is null then
    raise exception 'umpire link was not found';
  end if;

  for v_patch in
    select value from jsonb_array_elements(p_patches)
  loop
    if jsonb_typeof(v_patch) <> 'object'
       or coalesce(v_patch->>'categoryId', '') = ''
       or coalesce(v_patch->>'matchId', '') = '' then
      raise exception 'match patch is invalid';
    end if;

    v_clean := '{}'::jsonb;
    v_set := v_patch->'set';
    if v_set is not null and jsonb_typeof(v_set) = 'object' then
      for v_key in
        select jsonb_object_keys(v_set)
      loop
        if v_key = any (v_allowed) then
          v_clean := v_clean || jsonb_build_object(v_key, v_set->v_key);
        end if;
      end loop;
    end if;

    v_categories := v_document->'categories';
    if v_categories is null or jsonb_typeof(v_categories) <> 'array' then
      raise exception 'tournament document is invalid';
    end if;
    v_found := false;
    for v_category_index in 0 .. jsonb_array_length(v_categories) - 1 loop
      if v_categories->v_category_index->>'id' <> v_patch->>'categoryId' then
        continue;
      end if;
      v_matches := coalesce(
        v_categories->v_category_index->'matches',
        '[]'::jsonb
      );
      for v_match_index in 0 .. jsonb_array_length(v_matches) - 1 loop
        if v_matches->v_match_index->>'id' <> v_patch->>'matchId' then
          continue;
        end if;
        v_matches := jsonb_set(
          v_matches,
          array[v_match_index::text],
          (v_matches->v_match_index) || v_clean
        );
        v_found := true;
      end loop;
      if not v_found and v_patch ? 'insert' then
        if jsonb_typeof(v_patch->'insert') <> 'object'
           or (v_patch->'insert'->>'id') <> (v_patch->>'matchId') then
          raise exception 'inserted match is invalid';
        end if;
        v_matches := coalesce(v_matches, '[]'::jsonb)
          || jsonb_build_array(v_patch->'insert');
        v_found := true;
      end if;
      if not v_found then
        raise exception 'match was not found';
      end if;
      v_categories := jsonb_set(
        v_categories,
        array[v_category_index::text, 'matches'],
        v_matches
      );
    end loop;
    if not v_found then
      raise exception 'category was not found';
    end if;
    v_document := jsonb_set(v_document, '{categories}', v_categories);
  end loop;

  update public.tournaments as tournament
  set document = v_document
  where tournament.id = v_id
  returning tournament.updated_at into v_updated;

  return jsonb_build_object(
    'document', v_document,
    'updated_at', v_updated
  );
end;
$$;

revoke all on function public.umpire_save_match_patches(text, jsonb) from public;
grant execute on function public.umpire_save_match_patches(text, jsonb) to anon, authenticated;
