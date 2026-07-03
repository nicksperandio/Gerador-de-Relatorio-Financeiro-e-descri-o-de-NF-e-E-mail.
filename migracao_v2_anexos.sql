-- Migração v2 para quem já rodou a primeira versão do sistema.
-- Execute no Supabase > SQL Editor para adicionar:
-- 1) campo do profissional que realizou o atendimento;
-- 2) tabela de anexos;
-- 3) bucket privado no Supabase Storage;
-- 4) políticas de segurança dos anexos.

alter table public.financial_records add column if not exists attending_professional text;

create table if not exists public.financial_record_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id uuid not null references public.financial_records(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists financial_record_attachments_user_id_idx on public.financial_record_attachments(user_id);
create index if not exists financial_record_attachments_record_id_idx on public.financial_record_attachments(record_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists financial_record_attachments_set_updated_at on public.financial_record_attachments;
create trigger financial_record_attachments_set_updated_at
before update on public.financial_record_attachments
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'financial-record-attachments',
  'financial-record-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.financial_record_attachments enable row level security;

drop policy if exists "financial_record_attachments_select_own" on public.financial_record_attachments;
drop policy if exists "financial_record_attachments_insert_own" on public.financial_record_attachments;
drop policy if exists "financial_record_attachments_update_own" on public.financial_record_attachments;
drop policy if exists "financial_record_attachments_delete_own" on public.financial_record_attachments;

create policy "financial_record_attachments_select_own" on public.financial_record_attachments for select to authenticated using (auth.uid() is not null and user_id = auth.uid());
create policy "financial_record_attachments_insert_own" on public.financial_record_attachments for insert to authenticated with check (auth.uid() is not null and user_id = auth.uid());
create policy "financial_record_attachments_update_own" on public.financial_record_attachments for update to authenticated using (auth.uid() is not null and user_id = auth.uid()) with check (auth.uid() is not null and user_id = auth.uid());
create policy "financial_record_attachments_delete_own" on public.financial_record_attachments for delete to authenticated using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "attachments_storage_select_own" on storage.objects;
drop policy if exists "attachments_storage_insert_own" on storage.objects;
drop policy if exists "attachments_storage_update_own" on storage.objects;
drop policy if exists "attachments_storage_delete_own" on storage.objects;

create policy "attachments_storage_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'financial-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_storage_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'financial-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_storage_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'financial-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'financial-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_storage_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'financial-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

grant select, insert, update, delete on public.financial_record_attachments to authenticated;
