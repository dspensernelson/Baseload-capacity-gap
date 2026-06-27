-- news_items — the durable archive behind the News page and weekly digest.
-- Populated daily by scripts/news_ingest.py (news-daily.yml) from free public
-- RSS/Atom feeds. `url` is unique so re-seeing an article updates last_seen
-- instead of creating a duplicate — the table is additive and de-duplicated.
-- scripts/generate_newsletter.py reads the recent window from here to build the
-- weekly `reports` digest, and src/pages/News.jsx renders a rolling feed.

create table if not exists public.news_items (
  id           uuid primary key default gen_random_uuid(),
  url          text not null unique,
  source       text not null,
  title        text not null,
  summary      text,
  published_at timestamptz,
  score        int,
  category     text,                          -- primary topic bucket
  topics       text[],                        -- all matched topic buckets
  entities     text[],                        -- companies / ISOs / regions detected
  image_url    text,                          -- best-effort image from the feed
  featured     boolean not null default false,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create index if not exists news_items_published_at_idx
  on public.news_items (published_at desc nulls last);

create index if not exists news_items_first_seen_idx
  on public.news_items (first_seen desc);

create index if not exists news_items_category_idx
  on public.news_items (category);

alter table public.news_items enable row level security;

create policy "public read news_items"
  on public.news_items for select
  using (true);

grant select on public.news_items to anon, authenticated;
