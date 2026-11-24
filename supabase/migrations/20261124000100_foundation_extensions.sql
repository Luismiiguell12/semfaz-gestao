-- =============================================================================
-- SEMFAZ Gestão — Fase 1B
-- Extensões, schema privado e funções utilitárias genéricas.
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Schema "private": funções auxiliares de autorização e triggers.
-- Não é exposto pela API (PostgREST expõe apenas "public" e "graphql_public").
create schema if not exists private;
revoke all on schema private from public;
-- As políticas RLS são avaliadas com o papel do chamador, que precisa de USAGE
-- no schema para executar as funções auxiliares.
grant usage on schema private to authenticated, service_role;

-- Nenhum objeto do schema public é acessível ao papel anônimo: o sistema não
-- possui páginas públicas com dados. A RLS continua sendo a barreira principal.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.department_kind as enum ('secretariat', 'directorate', 'unit');
create type public.user_status as enum ('active', 'inactive', 'blocked');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

-- Conversão segura de texto para inet (cabeçalhos HTTP podem ser inválidos).
create or replace function private.try_inet(p_value text)
returns inet
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return btrim(p_value)::inet;
exception when others then
  return null;
end;
$$;

-- Cabeçalhos da requisição PostgREST atual (nulo fora da API).
create or replace function private.request_header(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> lower(p_name);
$$;

-- Preenche created_at/created_by/updated_at/updated_by a partir de auth.uid().
-- O cliente nunca define esses valores. Exceção: chamadas com service_role
-- (Edge Functions), que podem informar o autor explicitamente.
create or replace function private.tg_set_actor_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    if v_uid is not null then
      new.created_by := v_uid;
      new.updated_by := v_uid;
    elsif not v_is_service then
      new.created_by := null;
      new.updated_by := null;
    else
      new.updated_by := coalesce(new.updated_by, new.created_by);
    end if;
  else
    -- Campos de criação são imutáveis.
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    if v_uid is not null then
      new.updated_by := v_uid;
    elsif not v_is_service then
      new.updated_by := null;
    end if;
  end if;
  return new;
end;
$$;

-- Para tabelas de vínculo que só possuem created_at/created_by.
create or replace function private.tg_set_creator_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin');
begin
  new.created_at := now();
  if v_uid is not null then
    new.created_by := v_uid;
  elsif not v_is_service then
    new.created_by := null;
  end if;
  return new;
end;
$$;

-- Impede exclusão física em tabelas de negócio (exclusão é lógica).
create or replace function private.tg_prevent_physical_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Exclusão física não permitida em %. Utilize a exclusão lógica.', tg_table_name
    using errcode = 'P0001';
end;
$$;
