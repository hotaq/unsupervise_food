-- Run this once in the Supabase SQL Editor BEFORE loading wikidata-foods.sql.

create extension if not exists pg_trgm;

create table if not exists public.food_ratings (
  id              bigserial primary key,
  food            text not null check (char_length(food) between 1 and 255),
  rating          smallint not null check (rating between 1 and 5),
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists food_ratings_sent_at_idx
  on public.food_ratings(sent_at desc);

alter table public.food_ratings enable row level security;

drop policy if exists "anyone can read ratings" on public.food_ratings;
create policy "anyone can read ratings"
  on public.food_ratings for select using (true);

drop policy if exists "anyone can insert ratings" on public.food_ratings;
create policy "anyone can insert ratings"
  on public.food_ratings for insert
  with check (true);

create table if not exists public.foods (
  id              bigserial primary key,
  wikidata_id     text unique,
  name_en         text,
  name_th         text,
  aliases         text[] not null default '{}',
  source          text not null default 'user' check (source in ('wikidata','user','curated')),
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Materialized search column maintained by a trigger below.
  -- (Cannot be GENERATED because array_to_string is not IMMUTABLE.)
  search_text     text,
  constraint foods_has_a_name check (name_en is not null or name_th is not null)
);

-- Keep search_text in sync.
create or replace function public.foods_set_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := lower(
    coalesce(new.name_en, '') || ' ' ||
    coalesce(new.name_th, '') || ' ' ||
    array_to_string(coalesce(new.aliases, '{}'::text[]), ' ')
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists foods_search_text_trg on public.foods;
create trigger foods_search_text_trg
  before insert or update on public.foods
  for each row execute function public.foods_set_search_text();

-- Trigram index for fast typo-tolerant search.
create index if not exists foods_search_trgm_idx
  on public.foods using gin (search_text gin_trgm_ops);

-- RLS so anonymous reads only see approved entries, but anyone can propose
-- a pending entry. Tighten later if you add auth.
alter table public.foods enable row level security;

drop policy if exists "anyone can read approved foods" on public.foods;
create policy "anyone can read approved foods"
  on public.foods for select using (status = 'approved');

drop policy if exists "anyone can propose pending foods" on public.foods;
create policy "anyone can propose pending foods"
  on public.foods for insert
  with check (status = 'pending' and source = 'user');

-- Link ratings to the foods table (without breaking existing rows).
alter table public.food_ratings
  add column if not exists food_id bigint references public.foods(id) on delete set null;

create index if not exists food_ratings_food_id_idx on public.food_ratings(food_id);
