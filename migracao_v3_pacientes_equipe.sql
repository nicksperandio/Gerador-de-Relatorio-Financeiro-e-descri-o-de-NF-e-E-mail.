-- Migração v3 | Núcleo ÚNick
-- Adiciona cadastro completo de pacientes, equipe, documentos/anexos e integração com fichas financeiras.
-- Execute no Supabase > SQL Editor depois de já ter rodado as versões anteriores.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) Pacientes: campos completos
alter table public.patients add column if not exists sex text;
alter table public.patients add column if not exists diagnosis text;
alter table public.patients add column if not exists cpf text;
alter table public.patients add column if not exists rg text;
alter table public.patients add column if not exists issuing_agency text;
alter table public.patients add column if not exists marital_status text;
alter table public.patients add column if not exists phone text;
alter table public.patients add column if not exists email text;
alter table public.patients add column if not exists country text;
alter table public.patients add column if not exists cep text;
alter table public.patients add column if not exists state text;
alter table public.patients add column if not exists city text;
alter table public.patients add column if not exists neighborhood text;
alter table public.patients add column if not exists street text;
alter table public.patients add column if not exists number text;
alter table public.patients add column if not exists complement text;
alter table public.patients add column if not exists father_name text;
alter table public.patients add column if not exists father_cpf text;
alter table public.patients add column if not exists father_issuing_agency text;
alter table public.patients add column if not exists father_phone text;
alter table public.patients add column if not exists father_email text;
alter table public.patients add column if not exists mother_name text;
alter table public.patients add column if not exists mother_cpf text;
alter table public.patients add column if not exists mother_issuing_agency text;
alter table public.patients add column if not exists mother_phone text;
alter table public.patients add column if not exists mother_email text;
alter table public.patients add column if not exists therapy_start_date date;
alter table public.patients add column if not exists health_insurance text;
alter table public.patients add column if not exists archive_reason text;
alter table public.patients add column if not exists archive_notes text;
alter table public.patients add column if not exists archived_at timestamptz;

-- Atualiza restrição de status para permitir arquivamento.
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public' and table_name = 'patients' and column_name = 'status'
  ) then
    alter table public.patients drop constraint if exists patients_status_check;
  end if;
end $$;
alter table public.patients add constraint patients_status_check check (status in ('ativo','inativo','arquivado'));

create index if not exists patients_city_idx on public.patients(city);
create index if not exists patients_status_idx on public.patients(status);
create index if not exists patients_health_insurance_idx on public.patients(health_insurance);

-- 2) Documentos dos pacientes
create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists patient_documents_user_id_idx on public.patient_documents(user_id);
create index if not exists patient_documents_patient_id_idx on public.patient_documents(patient_id);
drop trigger if exists patient_documents_set_updated_at on public.patient_documents;
create trigger patient_documents_set_updated_at before update on public.patient_documents for each row execute function public.set_updated_at();

-- 3) Equipe/profissionais
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  person_type text,
  birth_date date,
  sex text,
  cpf text,
  rg text,
  issuing_agency text,
  marital_status text,
  phone text,
  whatsapp text,
  email text,
  country text,
  cep text,
  state text,
  city text,
  neighborhood text,
  street text,
  number text,
  complement text,
  practice_area text,
  professional_registry text,
  emergency_phone text,
  emergency_relationship text,
  bank_name text,
  bank_agency text,
  bank_account text,
  payment_methods text,
  pj_data text,
  status text not null default 'ativo' check (status in ('ativo','inativo','arquivado')),
  archive_reason text,
  archive_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists team_members_user_id_idx on public.team_members(user_id);
create index if not exists team_members_name_idx on public.team_members using gin (to_tsvector('portuguese', coalesce(full_name, '')));
create index if not exists team_members_status_idx on public.team_members(status);
create index if not exists team_members_practice_area_idx on public.team_members(practice_area);
drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at before update on public.team_members for each row execute function public.set_updated_at();

-- 4) Documentos da equipe
create table if not exists public.team_member_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists team_member_documents_user_id_idx on public.team_member_documents(user_id);
create index if not exists team_member_documents_team_member_id_idx on public.team_member_documents(team_member_id);
drop trigger if exists team_member_documents_set_updated_at on public.team_member_documents;
create trigger team_member_documents_set_updated_at before update on public.team_member_documents for each row execute function public.set_updated_at();

-- 5) Fichas financeiras: vínculo opcional com profissional da equipe
alter table public.financial_records add column if not exists team_member_id uuid references public.team_members(id);
create index if not exists financial_records_team_member_id_idx on public.financial_records(team_member_id);

-- 6) Storage privado para documentos de pacientes e equipe
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('patient-documents', 'patient-documents', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf']::text[]),
  ('team-member-documents', 'team-member-documents', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 7) RLS
alter table public.patient_documents enable row level security;
alter table public.team_members enable row level security;
alter table public.team_member_documents enable row level security;

-- Limpa políticas v3 se já existirem
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('patient_documents','team_members','team_member_documents')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

drop policy if exists "patient_docs_storage_select_own" on storage.objects;
drop policy if exists "patient_docs_storage_insert_own" on storage.objects;
drop policy if exists "patient_docs_storage_update_own" on storage.objects;
drop policy if exists "patient_docs_storage_delete_own" on storage.objects;
drop policy if exists "team_docs_storage_select_own" on storage.objects;
drop policy if exists "team_docs_storage_insert_own" on storage.objects;
drop policy if exists "team_docs_storage_update_own" on storage.objects;
drop policy if exists "team_docs_storage_delete_own" on storage.objects;

-- Patient documents
create policy "patient_documents_select_own" on public.patient_documents for select to authenticated using (auth.uid() is not null and user_id = auth.uid());
create policy "patient_documents_insert_own" on public.patient_documents for insert to authenticated with check (auth.uid() is not null and user_id = auth.uid());
create policy "patient_documents_update_own" on public.patient_documents for update to authenticated using (auth.uid() is not null and user_id = auth.uid()) with check (auth.uid() is not null and user_id = auth.uid());
create policy "patient_documents_delete_own" on public.patient_documents for delete to authenticated using (auth.uid() is not null and user_id = auth.uid());

-- Team members
create policy "team_members_select_own" on public.team_members for select to authenticated using (auth.uid() is not null and user_id = auth.uid());
create policy "team_members_insert_own" on public.team_members for insert to authenticated with check (auth.uid() is not null and user_id = auth.uid());
create policy "team_members_update_own" on public.team_members for update to authenticated using (auth.uid() is not null and user_id = auth.uid()) with check (auth.uid() is not null and user_id = auth.uid());
create policy "team_members_delete_own" on public.team_members for delete to authenticated using (auth.uid() is not null and user_id = auth.uid());

-- Team member documents
create policy "team_member_documents_select_own" on public.team_member_documents for select to authenticated using (auth.uid() is not null and user_id = auth.uid());
create policy "team_member_documents_insert_own" on public.team_member_documents for insert to authenticated with check (auth.uid() is not null and user_id = auth.uid());
create policy "team_member_documents_update_own" on public.team_member_documents for update to authenticated using (auth.uid() is not null and user_id = auth.uid()) with check (auth.uid() is not null and user_id = auth.uid());
create policy "team_member_documents_delete_own" on public.team_member_documents for delete to authenticated using (auth.uid() is not null and user_id = auth.uid());

-- Storage policies: cada usuário acessa somente a própria pasta dentro do bucket.
create policy "patient_docs_storage_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'patient-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "patient_docs_storage_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'patient-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "patient_docs_storage_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'patient-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'patient-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "patient_docs_storage_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'patient-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "team_docs_storage_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'team-member-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "team_docs_storage_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'team-member-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "team_docs_storage_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'team-member-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'team-member-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "team_docs_storage_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'team-member-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- 8) Grants
grant select, insert, update, delete on public.patient_documents to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.team_member_documents to authenticated;
