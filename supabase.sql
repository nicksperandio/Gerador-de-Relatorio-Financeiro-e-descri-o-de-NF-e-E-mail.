-- Clínica ÚNick | Sistema Financeiro e Nota Fiscal
-- Execute este arquivo no Supabase > SQL Editor.
-- Estrutura: Auth + tabelas + relacionamentos + RLS + políticas.

create extension if not exists "pgcrypto";

-- 1. Função para updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 3. Pacientes
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  birth_date date,
  admin_notes text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists patients_user_id_idx on public.patients(user_id);
create index if not exists patients_name_idx on public.patients using gin (to_tsvector('portuguese', coalesce(full_name, '')));
create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

-- 4. Responsáveis
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  cpf text,
  email text,
  phone text,
  address text,
  relationship text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists guardians_user_id_idx on public.guardians(user_id);
create index if not exists guardians_name_idx on public.guardians using gin (to_tsvector('portuguese', coalesce(full_name, '')));
create trigger guardians_set_updated_at
before update on public.guardians
for each row execute function public.set_updated_at();

-- 5. Vínculo muitos-para-muitos entre pacientes e responsáveis
create table if not exists public.patient_guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists patient_guardians_user_id_idx on public.patient_guardians(user_id);
create index if not exists patient_guardians_patient_id_idx on public.patient_guardians(patient_id);
create index if not exists patient_guardians_guardian_id_idx on public.patient_guardians(guardian_id);
create trigger patient_guardians_set_updated_at
before update on public.patient_guardians
for each row execute function public.set_updated_at();

-- 6. Configurações fixas da clínica/profissional
create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clinic_name text,
  professional_name text,
  professional_title text,
  professional_registry text,
  cnpj text,
  phone text,
  email text,
  address text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_name text,
  pix_phone text,
  pix_email text,
  pix_cnpj text,
  default_nf_text text,
  default_notes text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clinic_settings_one_per_user unique (user_id)
);

create index if not exists clinic_settings_user_id_idx on public.clinic_settings(user_id);
create trigger clinic_settings_set_updated_at
before update on public.clinic_settings
for each row execute function public.set_updated_at();

-- 7. Fichas financeiras
create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  guardian_id uuid references public.guardians(id),
  reference_month smallint not null check (reference_month between 1 and 12),
  reference_year integer not null check (reference_year between 2020 and 2100),
  service_modality text,
  care_location text,
  session_value numeric(12,2) not null default 0,
  sessions jsonb not null default '[]'::jsonb,
  total_sessions integer not null default 0,
  total_value numeric(12,2) not null default 0,
  payment_method text,
  issue_date date,
  due_date date,
  payment_link text,
  nf_description text,
  admin_notes text,
  status text not null default 'aguardando_pagamento' check (status in ('aguardando_pagamento', 'pago', 'nf_emitida', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists financial_records_user_id_idx on public.financial_records(user_id);
create index if not exists financial_records_patient_id_idx on public.financial_records(patient_id);
create index if not exists financial_records_guardian_id_idx on public.financial_records(guardian_id);
create index if not exists financial_records_month_year_idx on public.financial_records(reference_year, reference_month);
create trigger financial_records_set_updated_at
before update on public.financial_records
for each row execute function public.set_updated_at();

-- 8. RLS
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.guardians enable row level security;
alter table public.patient_guardians enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.financial_records enable row level security;

-- Limpeza de políticas antigas, caso você rode o SQL mais de uma vez
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "patients_select_own" on public.patients;
drop policy if exists "patients_insert_own" on public.patients;
drop policy if exists "patients_update_own" on public.patients;
drop policy if exists "patients_delete_own" on public.patients;

drop policy if exists "guardians_select_own" on public.guardians;
drop policy if exists "guardians_insert_own" on public.guardians;
drop policy if exists "guardians_update_own" on public.guardians;
drop policy if exists "guardians_delete_own" on public.guardians;

drop policy if exists "patient_guardians_select_own" on public.patient_guardians;
drop policy if exists "patient_guardians_insert_own" on public.patient_guardians;
drop policy if exists "patient_guardians_update_own" on public.patient_guardians;
drop policy if exists "patient_guardians_delete_own" on public.patient_guardians;

drop policy if exists "clinic_settings_select_own" on public.clinic_settings;
drop policy if exists "clinic_settings_insert_own" on public.clinic_settings;
drop policy if exists "clinic_settings_update_own" on public.clinic_settings;
drop policy if exists "clinic_settings_delete_own" on public.clinic_settings;

drop policy if exists "financial_records_select_own" on public.financial_records;
drop policy if exists "financial_records_insert_own" on public.financial_records;
drop policy if exists "financial_records_update_own" on public.financial_records;
drop policy if exists "financial_records_delete_own" on public.financial_records;

-- Profiles
create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() is not null and id = auth.uid());

create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() is not null and id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() is not null and id = auth.uid())
with check (auth.uid() is not null and id = auth.uid());

-- Patients
create policy "patients_select_own" on public.patients
for select to authenticated
using (auth.uid() is not null and user_id = auth.uid());

create policy "patients_insert_own" on public.patients
for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

create policy "patients_update_own" on public.patients
for update to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

create policy "patients_delete_own" on public.patients
for delete to authenticated
using (auth.uid() is not null and user_id = auth.uid());

-- Guardians
create policy "guardians_select_own" on public.guardians
for select to authenticated
using (auth.uid() is not null and user_id = auth.uid());

create policy "guardians_insert_own" on public.guardians
for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

create policy "guardians_update_own" on public.guardians
for update to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

create policy "guardians_delete_own" on public.guardians
for delete to authenticated
using (auth.uid() is not null and user_id = auth.uid());

-- Patient guardians
create policy "patient_guardians_select_own" on public.patient_guardians
for select to authenticated
using (auth.uid() is not null and user_id = auth.uid());

create policy "patient_guardians_insert_own" on public.patient_guardians
for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

create policy "patient_guardians_update_own" on public.patient_guardians
for update to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

create policy "patient_guardians_delete_own" on public.patient_guardians
for delete to authenticated
using (auth.uid() is not null and user_id = auth.uid());

-- Clinic settings
create policy "clinic_settings_select_own" on public.clinic_settings
for select to authenticated
using (auth.uid() is not null and user_id = auth.uid());

create policy "clinic_settings_insert_own" on public.clinic_settings
for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

create policy "clinic_settings_update_own" on public.clinic_settings
for update to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

create policy "clinic_settings_delete_own" on public.clinic_settings
for delete to authenticated
using (auth.uid() is not null and user_id = auth.uid());

-- Financial records
create policy "financial_records_select_own" on public.financial_records
for select to authenticated
using (auth.uid() is not null and user_id = auth.uid());

create policy "financial_records_insert_own" on public.financial_records
for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

create policy "financial_records_update_own" on public.financial_records
for update to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

create policy "financial_records_delete_own" on public.financial_records
for delete to authenticated
using (auth.uid() is not null and user_id = auth.uid());

-- 9. Grants para uso pelo cliente autenticado.
-- Mantenha RLS habilitado. A anon role não recebe acesso direto às tabelas.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.patients to authenticated;
grant select, insert, update, delete on public.guardians to authenticated;
grant select, insert, update, delete on public.patient_guardians to authenticated;
grant select, insert, update, delete on public.clinic_settings to authenticated;
grant select, insert, update, delete on public.financial_records to authenticated;
