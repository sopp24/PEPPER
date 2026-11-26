-- PEPPER : synchronisation privée entre appareils.
-- À coller dans Supabase → SQL Editor → Run (une seule fois).

create table if not exists public.pepper_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pepper_state enable row level security;

-- Chaque utilisateur ne voit et ne modifie que sa propre ligne.
drop policy if exists "pepper_state_select_own" on public.pepper_state;
drop policy if exists "pepper_state_insert_own" on public.pepper_state;
drop policy if exists "pepper_state_update_own" on public.pepper_state;
drop policy if exists "pepper_state_delete_own" on public.pepper_state;

create policy "pepper_state_select_own" on public.pepper_state for select to authenticated using (auth.uid() = user_id);
create policy "pepper_state_insert_own" on public.pepper_state for insert to authenticated with check (auth.uid() = user_id);
create policy "pepper_state_update_own" on public.pepper_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pepper_state_delete_own" on public.pepper_state for delete to authenticated using (auth.uid() = user_id);
