-- Align public.categories with Base44 Category schema only.
-- Base44 Category schema:
-- name_en (required text), name_ar (text), name_fa (text), icon (text), color (text),
-- type (text), is_active (boolean), is_favorite (boolean), sort_order (number)

-- Preserve existing legacy English names by renaming name -> name_en when needed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categories' and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categories' and column_name = 'name_en'
  ) then
    alter table public.categories rename column name to name_en;
  end if;
end $$;

alter table public.categories
  add column if not exists name_en text,
  add column if not exists name_ar text,
  add column if not exists name_fa text,
  add column if not exists is_active boolean,
  add column if not exists is_favorite boolean,
  add column if not exists sort_order numeric;

-- Base44-compatible defaults for smooth client-side inserts.
alter table public.categories
  alter column name_en set not null,
  alter column icon set default '📦',
  alter column color set default '#3B82F6',
  alter column type drop not null,
  alter column type set default 'Other',
  alter column is_active set default true,
  alter column is_favorite set default false,
  alter column sort_order set default 0;

update public.categories
set
  icon = coalesce(icon, '📦'),
  color = coalesce(color, '#3B82F6'),
  type = coalesce(type, 'Other'),
  is_active = coalesce(is_active, true),
  is_favorite = coalesce(is_favorite, false),
  sort_order = coalesce(sort_order, 0)
where icon is null
   or color is null
   or type is null
   or is_active is null
   or is_favorite is null
   or sort_order is null;

-- Category lookup indexes used by UI listing and Product category selection.
create index if not exists idx_categories_restaurant_id on public.categories (restaurant_id);
create index if not exists idx_categories_active_sort on public.categories (is_active, sort_order, name_en);
create index if not exists idx_categories_name_en on public.categories (name_en);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own_or_restaurant" on public.categories;
drop policy if exists "categories_insert_own_or_restaurant" on public.categories;
drop policy if exists "categories_update_own_or_restaurant" on public.categories;
drop policy if exists "categories_delete_own_or_restaurant" on public.categories;

create policy "categories_select_own_or_restaurant"
  on public.categories
  for select
  to authenticated
  using (
    created_by = auth.email()
    or restaurant_id in (select id from public.restaurants where org_id = auth.email())
  );

create policy "categories_insert_own_or_restaurant"
  on public.categories
  for insert
  to authenticated
  with check (
    created_by = auth.email()
    or restaurant_id in (select id from public.restaurants where org_id = auth.email())
  );

create policy "categories_update_own_or_restaurant"
  on public.categories
  for update
  to authenticated
  using (
    created_by = auth.email()
    or restaurant_id in (select id from public.restaurants where org_id = auth.email())
  )
  with check (
    created_by = auth.email()
    or restaurant_id in (select id from public.restaurants where org_id = auth.email())
  );

create policy "categories_delete_own_or_restaurant"
  on public.categories
  for delete
  to authenticated
  using (
    created_by = auth.email()
    or restaurant_id in (select id from public.restaurants where org_id = auth.email())
  );
