-- Correção ÚNick: anexos/imagens da ficha financeira
-- Execute este arquivo no Supabase > SQL Editor > New query > Run.
-- Objetivo: criar os buckets e políticas de Storage para permitir salvar e abrir imagens/anexos por usuário logado.

-- 1) Criar buckets privados usados pelo sistema
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('financial-record-attachments', 'financial-record-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif']::text[]),
  ('patient-documents', 'patient-documents', false, 20971520, array['image/jpeg','image/png','image/webp','image/gif','application/pdf']::text[]),
  ('team-member-documents', 'team-member-documents', false, 20971520, array['image/jpeg','image/png','image/webp','image/gif','application/pdf']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2) Garantir colunas/tabelas usadas pelos anexos das fichas financeiras
alter table public.financial_records
add column if not exists team_member_id uuid,
add column if not exists attending_professional text;

create table if not exists public.financial_record_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id uuid not null references public.financial_records(id) on delete cascade,
  file_name text,
  file_path text not null,
  file_type text,
  file_size bigint,
  display_order integer default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists financial_record_attachments_user_id_idx on public.financial_record_attachments(user_id);
create index if not exists financial_record_attachments_record_id_idx on public.financial_record_attachments(record_id);

alter table public.financial_record_attachments enable row level security;

drop policy if exists "financial_record_attachments_select_own" on public.financial_record_attachments;
drop policy if exists "financial_record_attachments_insert_own" on public.financial_record_attachments;
drop policy if exists "financial_record_attachments_update_own" on public.financial_record_attachments;
drop policy if exists "financial_record_attachments_delete_own" on public.financial_record_attachments;

create policy "financial_record_attachments_select_own" on public.financial_record_attachments
for select to authenticated
using (auth.uid() is not null and user_id = auth.uid());

create policy "financial_record_attachments_insert_own" on public.financial_record_attachments
for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

create policy "financial_record_attachments_update_own" on public.financial_record_attachments
for update to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

create policy "financial_record_attachments_delete_own" on public.financial_record_attachments
for delete to authenticated
using (auth.uid() is not null and user_id = auth.uid());

grant select, insert, update, delete on public.financial_record_attachments to authenticated;

-- 3) Políticas de Storage: cada usuário acessa apenas arquivos dentro da própria pasta auth.uid()/...
drop policy if exists "financial_storage_select_own" on storage.objects;
drop policy if exists "financial_storage_insert_own" on storage.objects;
drop policy if exists "financial_storage_update_own" on storage.objects;
drop policy if exists "financial_storage_delete_own" on storage.objects;

create policy "financial_storage_select_own" on storage.objects
for select to authenticated
using (
  bucket_id in ('financial-record-attachments','patient-documents','team-member-documents')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "financial_storage_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('financial-record-attachments','patient-documents','team-member-documents')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "financial_storage_update_own" on storage.objects
for update to authenticated
using (
  bucket_id in ('financial-record-attachments','patient-documents','team-member-documents')
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id in ('financial-record-attachments','patient-documents','team-member-documents')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "financial_storage_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id in ('financial-record-attachments','patient-documents','team-member-documents')
  and auth.uid()::text = (storage.foldername(name))[1]
);

notify pgrst, 'reload schema';
