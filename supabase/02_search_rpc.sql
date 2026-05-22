-- Optional: a ranked search function using pg_trgm similarity().
-- Run this in Supabase SQL Editor after 01_foods.sql.

create or replace function public.search_foods(q text, max_results int default 10)
returns table (
  id bigint,
  name_en text,
  name_th text,
  aliases text[],
  score real
)
language sql
stable
as $$
  select id, name_en, name_th, aliases,
         greatest(
           similarity(search_text, lower(q)),
           similarity(coalesce(name_en, ''), q),
           similarity(coalesce(name_th, ''), q)
         ) as score
  from public.foods
  where status = 'approved'
    and (search_text % lower(q) or search_text ilike '%' || lower(q) || '%')
  order by score desc nulls last, name_en
  limit max_results;
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;
