create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default jsonb_build_object('records','[]'::jsonb,'gyms','[]'::jsonb),
  updated_at timestamptz not null default now()
);
alter table public.user_app_state enable row level security;
revoke all on public.user_app_state from anon;
grant select, insert, update, delete on public.user_app_state to authenticated;
drop policy if exists "Users manage their own app state" on public.user_app_state;
create policy "Users manage their own app state" on public.user_app_state for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
