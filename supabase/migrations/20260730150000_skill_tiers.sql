-- Upgrade path for databases that stored skill as integer 1–5.
-- Fresh installs from init.sql already use public.skill_tier and no-op here.

do $$
begin
  create type public.skill_tier as enum (
    'beginner',
    'novice',
    'intermediate',
    'advanced'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'skill'
      and udt_name = 'int4'
  ) then
    alter table public.players drop constraint if exists players_skill_check;
    alter table public.players alter column skill drop default;

    alter table public.players
      alter column skill type public.skill_tier
      using (
        case skill
          when 1 then 'beginner'::public.skill_tier
          when 2 then 'novice'::public.skill_tier
          when 3 then 'intermediate'::public.skill_tier
          when 4 then 'intermediate'::public.skill_tier
          when 5 then 'advanced'::public.skill_tier
          else 'intermediate'::public.skill_tier
        end
      ),
      alter column skill set default 'intermediate'::public.skill_tier;

    alter table public.session_players drop constraint if exists session_players_skill_check;
    alter table public.session_players alter column skill drop default;

    alter table public.session_players
      alter column skill type public.skill_tier
      using (
        case skill
          when 1 then 'beginner'::public.skill_tier
          when 2 then 'novice'::public.skill_tier
          when 3 then 'intermediate'::public.skill_tier
          when 4 then 'intermediate'::public.skill_tier
          when 5 then 'advanced'::public.skill_tier
          else 'intermediate'::public.skill_tier
        end
      ),
      alter column skill set default 'intermediate'::public.skill_tier;

    alter table public.courts
      alter column skill_min type public.skill_tier
      using (
        case skill_min
          when 1 then 'beginner'::public.skill_tier
          when 2 then 'novice'::public.skill_tier
          when 3 then 'intermediate'::public.skill_tier
          when 4 then 'intermediate'::public.skill_tier
          when 5 then 'advanced'::public.skill_tier
          else null
        end
      );

    alter table public.courts
      alter column skill_max type public.skill_tier
      using (
        case skill_max
          when 1 then 'beginner'::public.skill_tier
          when 2 then 'novice'::public.skill_tier
          when 3 then 'intermediate'::public.skill_tier
          when 4 then 'intermediate'::public.skill_tier
          when 5 then 'advanced'::public.skill_tier
          else null
        end
      );
  end if;
end $$;
