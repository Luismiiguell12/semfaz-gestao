-- =============================================================================
-- SEMFAZ Gestão — Fase 1B
-- Infraestrutura genérica de documentos: bucket privado, metadados e políticas.
-- Os arquivos são enviados exclusivamente pela Edge Function "documents-upload",
-- que valida o tipo real (assinatura binária), o tamanho e calcula o SHA-256.
-- =============================================================================

-- Bucket privado. Limite físico de 10 MB; o limite efetivo é configurável
-- em system_settings (documents.max_file_size_mb), validado na Edge Function e no banco.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  -- Registro associado. Novos tipos são habilitados a cada fase (imóveis, contratos...).
  entity_type text not null check (entity_type in ('department')),
  entity_id uuid not null,
  bucket_id text not null default 'documents' check (bucket_id = 'documents'),
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[a-z_]+/[0-9a-f-]{36}$'),
  original_name text not null check (length(original_name) between 1 and 255 and original_name !~ '[/\\]'),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  description text check (description is null or length(description) <= 500),
  version integer not null default 1 check (version >= 1),
  previous_version_id uuid unique references public.documents (id),
  is_current boolean not null default true,
  uploaded_by uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  deletion_reason text,
  constraint documents_version_chain check ((version = 1) = (previous_version_id is null))
);
create index documents_entity_idx on public.documents (entity_type, entity_id) where deleted_at is null;
create index documents_org_idx on public.documents (organization_id);
comment on table public.documents is 'Metadados de arquivos do Storage. Arquivos nunca são apagados; a substituição cria nova versão.';

create trigger documents_actor before insert or update on public.documents
  for each row execute function private.tg_set_actor_columns();
create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function private.tg_audit('documents');
create trigger documents_no_delete before delete on public.documents
  for each row execute function private.tg_prevent_physical_delete();

-- Metadados técnicos são imutáveis após o envio.
create or replace function private.tg_documents_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.organization_id, new.entity_type, new.entity_id, new.storage_path, new.original_name,
      new.mime_type, new.size_bytes, new.sha256, new.version, new.uploaded_by, new.uploaded_at)
     is distinct from
     (old.organization_id, old.entity_type, old.entity_id, old.storage_path, old.original_name,
      old.mime_type, old.size_bytes, old.sha256, old.version, old.uploaded_by, old.uploaded_at) then
    raise exception 'Os metadados de um documento enviado não podem ser alterados. Envie uma nova versão.'
      using errcode = '42501';
  end if;
  if old.is_current = false and new.is_current = true then
    raise exception 'Uma versão substituída não pode voltar a ser a versão atual.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger documents_immutable before update on public.documents
  for each row execute function private.tg_documents_immutable_fields();

-- -----------------------------------------------------------------------------
-- Autorização por registro associado
-- -----------------------------------------------------------------------------
-- p_action: 'view' (consultar/baixar) ou 'attach' (enviar/substituir).
create or replace function private.can_access_document_entity(p_entity_type text, p_entity_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() or p_action not in ('view', 'attach') then
    return false;
  end if;

  case p_entity_type
    when 'department' then
      if not exists (
        select 1 from public.departments d
        where d.id = p_entity_id and d.organization_id = private.current_org_id() and d.deleted_at is null
      ) then
        return false;
      end if;
      if p_action = 'view' then
        return private.department_in_scope(p_entity_id) or private.has_permission('departments.manage');
      end if;
      return private.has_permission('departments.manage');
    else
      -- Tipo não suportado: negado por padrão.
      return false;
  end case;
end;
$$;

create or replace function public.can_attach_document(p_entity_type text, p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_document_entity(p_entity_type, p_entity_id, 'attach');
$$;
revoke execute on function public.can_attach_document(text, uuid) from public, anon;
grant execute on function public.can_attach_document(text, uuid) to authenticated;

-- Registro de metadados: executável SOMENTE pelo service_role (Edge Function),
-- após a validação do arquivo. Garante a troca de versão de forma transacional.
create or replace function public.service_register_document(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text,
  p_description text default null,
  p_replaces_document_id uuid default null
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_previous public.documents;
  v_doc public.documents;
  v_max_mb numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operação restrita ao backend.' using errcode = '42501';
  end if;

  select p.organization_id into v_org from public.profiles p
  where p.id = p_user_id and p.status = 'active' and p.deleted_at is null;
  if v_org is null then
    raise exception 'Usuário inválido ou inativo.' using errcode = '42501';
  end if;

  v_max_mb := coalesce((private.setting(v_org, 'documents.max_file_size_mb', '10'::jsonb))::text::numeric, 10);
  if p_size_bytes > v_max_mb * 1024 * 1024 then
    raise exception 'Arquivo excede o tamanho máximo de % MB.', v_max_mb using errcode = '22023';
  end if;

  if p_replaces_document_id is not null then
    select * into v_previous from public.documents d
    where d.id = p_replaces_document_id for update;
    if not found or v_previous.deleted_at is not null then
      raise exception 'Documento a substituir não encontrado.' using errcode = 'P0002';
    end if;
    if not v_previous.is_current then
      raise exception 'Somente a versão atual pode ser substituída.' using errcode = '22023';
    end if;
    if v_previous.entity_type <> p_entity_type or v_previous.entity_id <> p_entity_id or v_previous.organization_id <> v_org then
      raise exception 'O documento a substituir pertence a outro registro.' using errcode = '22023';
    end if;
    update public.documents set is_current = false, updated_by = p_user_id where id = v_previous.id;
  end if;

  insert into public.documents (
    organization_id, entity_type, entity_id, storage_path, original_name, mime_type,
    size_bytes, sha256, description, version, previous_version_id, uploaded_by, created_by, updated_by
  ) values (
    v_org, p_entity_type, p_entity_id, p_storage_path, p_original_name, p_mime_type,
    p_size_bytes, lower(p_sha256), nullif(btrim(p_description), ''),
    coalesce(v_previous.version + 1, 1), v_previous.id, p_user_id, p_user_id, p_user_id
  ) returning * into v_doc;

  return v_doc;
end;
$$;
revoke execute on function public.service_register_document(uuid, text, uuid, text, text, text, bigint, text, text, uuid) from public, anon, authenticated;
grant execute on function public.service_register_document(uuid, text, uuid, text, text, text, bigint, text, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Políticas do Storage: leitura somente quando o registro associado é acessível.
-- Não há políticas de INSERT/UPDATE/DELETE para usuários: envio apenas pela
-- Edge Function; exclusão física proibida.
-- -----------------------------------------------------------------------------
create policy "documents_bucket_select_authorized"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
        and d.deleted_at is null
        and private.can_access_document_entity(d.entity_type, d.entity_id, 'view')
    )
  );
