-- GreyTraining — Supabase schema.
-- Paste into Supabase → SQL Editor → New query, then Run. Safe to run more than once.
--
-- One JSON document per user holds everything the app saves (the same fields it keeps on the
-- phone). The phone stays the primary copy and syncs this row when online.

create table if not exists public.gt_state (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  data              jsonb       not null,
  client_updated_at bigint      not null default 0,   -- ms timestamp of the change on the device
  updated_at        timestamptz not null default now()
);

-- Keep updated_at honest on every write
create or replace function public.gt_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists gt_state_touch on public.gt_state;
create trigger gt_state_touch before insert or update on public.gt_state
for each row execute function public.gt_touch_updated_at();

-- Never let an older copy overwrite a newer one (a device that was offline or behind).
-- Returning null skips the update; the app sees no row back and pulls the newer copy instead.
create or replace function public.gt_keep_newer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.client_updated_at < old.client_updated_at then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists gt_state_keep_newer on public.gt_state;
create trigger gt_state_keep_newer before update on public.gt_state
for each row execute function public.gt_keep_newer();

-- Row level security: each signed-in user sees and writes only their own row.
alter table public.gt_state enable row level security;

drop policy if exists "gt_state_select_own" on public.gt_state;
drop policy if exists "gt_state_insert_own" on public.gt_state;
drop policy if exists "gt_state_update_own" on public.gt_state;
drop policy if exists "gt_state_delete_own" on public.gt_state;

create policy "gt_state_select_own" on public.gt_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "gt_state_insert_own" on public.gt_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "gt_state_update_own" on public.gt_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "gt_state_delete_own" on public.gt_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous visitors get nothing; signed-in users get only what the policies above allow.
revoke all on public.gt_state from anon;
grant select, insert, update, delete on public.gt_state to authenticated;
