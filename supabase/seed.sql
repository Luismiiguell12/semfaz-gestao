-- =============================================================================
-- SEMFAZ Gestão — Seed ESTRUTURAL (idempotente)
-- Contém somente dados estruturais: organização, perfis de acesso, permissões,
-- tipos de notificação e configurações padrão. Nenhum dado pessoal ou fictício.
-- Aplicado localmente por `supabase db reset` e nos ambientes remotos por
-- `supabase db push --include-seed` (workflow de migrations).
-- ATENÇÃO: nos ambientes remotos o seed só roda na primeira vez. Dados
-- estruturais novos devem entrar também por migration (ver 20261125000800).
-- =============================================================================

-- Organização inicial
insert into public.organizations (id, name, short_name)
values ('00000000-0000-4000-8000-000000000001', 'Prefeitura Municipal de Lagarto', 'Lagarto/SE')
on conflict (id) do nothing;

-- Estrutura inicial: a secretaria que inicia o uso do sistema
insert into public.departments (id, organization_id, parent_id, kind, name, acronym)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', null,
        'secretariat', 'Secretaria Municipal da Fazenda', 'SEMFAZ')
on conflict (id) do nothing;

-- O catálogo de permissões é mantido pela migration 20261125000050_permissions_catalog.sql.

-- -----------------------------------------------------------------------------
-- Perfis de acesso iniciais (configuráveis). O perfil "admin" possui todas as
-- permissões implicitamente; os demais recebem o conjunto padrão abaixo.
-- -----------------------------------------------------------------------------
insert into public.roles (id, organization_id, code, name, description, is_system) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'admin',        'Administrador', 'Acesso total. Aprova solicitações. MFA obrigatório.', true),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'manager',      'Gestor',        'Gerencia cadastros e acompanha a equipe. MFA recomendado.', true),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'collaborator', 'Colaborador',   'Executa demandas e lançamentos no seu escopo.', true),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'viewer',       'Consulta',      'Somente consulta no seu escopo.', true)
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_code, organization_id)
select r.role_id::uuid, r.code, '00000000-0000-4000-8000-000000000001'
from (values
  -- Gestor
  ('00000000-0000-4000-8000-000000000202', 'properties.view'),
  ('00000000-0000-4000-8000-000000000202', 'properties.create'),
  ('00000000-0000-4000-8000-000000000202', 'properties.update'),
  ('00000000-0000-4000-8000-000000000202', 'landlords.view'),
  ('00000000-0000-4000-8000-000000000202', 'landlords.manage'),
  ('00000000-0000-4000-8000-000000000202', 'contracts.view'),
  ('00000000-0000-4000-8000-000000000202', 'contracts.manage'),
  ('00000000-0000-4000-8000-000000000202', 'contracts.documents.view'),
  ('00000000-0000-4000-8000-000000000202', 'utilities.view'),
  ('00000000-0000-4000-8000-000000000202', 'utilities.manage'),
  ('00000000-0000-4000-8000-000000000202', 'invoices.view'),
  ('00000000-0000-4000-8000-000000000202', 'invoices.manage'),
  ('00000000-0000-4000-8000-000000000202', 'finance.documents.view'),
  ('00000000-0000-4000-8000-000000000202', 'tasks.view_all'),
  ('00000000-0000-4000-8000-000000000202', 'tasks.create'),
  ('00000000-0000-4000-8000-000000000202', 'tasks.complete'),
  ('00000000-0000-4000-8000-000000000202', 'tasks.delete_own'),
  ('00000000-0000-4000-8000-000000000202', 'tasks.categories.manage'),
  ('00000000-0000-4000-8000-000000000202', 'productivity.view_own'),
  ('00000000-0000-4000-8000-000000000202', 'productivity.view_team'),
  ('00000000-0000-4000-8000-000000000202', 'reports.export'),
  -- Colaborador
  ('00000000-0000-4000-8000-000000000203', 'properties.view'),
  ('00000000-0000-4000-8000-000000000203', 'landlords.view'),
  ('00000000-0000-4000-8000-000000000203', 'contracts.view'),
  ('00000000-0000-4000-8000-000000000203', 'utilities.view'),
  ('00000000-0000-4000-8000-000000000203', 'invoices.view'),
  ('00000000-0000-4000-8000-000000000203', 'invoices.manage'),
  ('00000000-0000-4000-8000-000000000203', 'tasks.create'),
  ('00000000-0000-4000-8000-000000000203', 'tasks.complete'),
  ('00000000-0000-4000-8000-000000000203', 'tasks.delete_own'),
  ('00000000-0000-4000-8000-000000000203', 'productivity.view_own'),
  -- Consulta
  ('00000000-0000-4000-8000-000000000204', 'properties.view'),
  ('00000000-0000-4000-8000-000000000204', 'landlords.view'),
  ('00000000-0000-4000-8000-000000000204', 'contracts.view'),
  ('00000000-0000-4000-8000-000000000204', 'utilities.view'),
  ('00000000-0000-4000-8000-000000000204', 'invoices.view'),
  ('00000000-0000-4000-8000-000000000204', 'productivity.view_own')
) as r(role_id, code)
on conflict (role_id, permission_code) do nothing;

-- -----------------------------------------------------------------------------
-- Tipos de notificação (os de fases futuras ficam indisponíveis até lá)
-- -----------------------------------------------------------------------------
insert into public.notification_types (code, module, description, is_available) values
  ('welcome',               'users',      'Conta criada', true),
  ('access_changed',        'users',      'Alteração de perfil de acesso', true),
  ('task_created',          'tasks',      'Nova demanda', false),
  ('task_assignee_changed', 'tasks',      'Alteração de responsável', false),
  ('task_comment',          'tasks',      'Comentário em demanda', false),
  ('task_due_soon',         'tasks',      'Prazo próximo', false),
  ('task_overdue',          'tasks',      'Demanda em atraso', false),
  ('task_completed',        'tasks',      'Demanda concluída', false),
  ('task_review',           'tasks',      'Demanda em revisão', false),
  ('contract_expiring',     'contracts',  'Vencimento contratual', true),
  ('contract_adjustment',   'contracts',  'Reajuste contratual (data-base)', true),
  ('invoice_overdue',       'finance',    'Fatura vencida', true),
  ('consumption_alert',     'finance',    'Alerta de consumo', true),
  ('approval_pending',      'approvals',  'Aprovação pendente', true),
  ('approval_approved',     'approvals',  'Solicitação aprovada', true),
  ('approval_rejected',     'approvals',  'Solicitação rejeitada', true)
on conflict (code) do update set module = excluded.module, description = excluded.description;

-- -----------------------------------------------------------------------------
-- Configurações padrão
-- -----------------------------------------------------------------------------
insert into public.system_settings (organization_id, key, value, description) values
  ('00000000-0000-4000-8000-000000000001', 'documents.max_file_size_mb', '10'::jsonb, 'Tamanho máximo de anexos, em MB (limite físico do bucket: 10 MB).'),
  ('00000000-0000-4000-8000-000000000001', 'documents.allowed_types', '["pdf","jpg","png","docx","xlsx"]'::jsonb, 'Tipos de arquivo permitidos.'),
  ('00000000-0000-4000-8000-000000000001', 'documents.signed_url_ttl_seconds', '60'::jsonb, 'Validade das URLs temporárias de download, em segundos.'),
  ('00000000-0000-4000-8000-000000000001', 'app.display_timezone', '"America/Maceio"'::jsonb, 'Fuso horário de exibição.')
on conflict (organization_id, key) do nothing;

-- -----------------------------------------------------------------------------
-- Regras de aprovação: todas as operações cadastradas exigem aprovação por padrão.
-- -----------------------------------------------------------------------------
insert into public.approval_rules (organization_id, operation_code, requires_approval)
select '00000000-0000-4000-8000-000000000001', o.code, true from public.approval_operations o
on conflict (organization_id, operation_code) do nothing;

-- -----------------------------------------------------------------------------
-- Listas configuráveis de contratos: apenas EXEMPLOS genéricos, editáveis.
-- As listas oficiais dependem de definição da SEMFAZ (pendência institucional).
-- -----------------------------------------------------------------------------
insert into public.adjustment_indexes (organization_id, name) values
  ('00000000-0000-4000-8000-000000000001', 'IPCA'),
  ('00000000-0000-4000-8000-000000000001', 'IGP-M')
on conflict do nothing;
insert into public.contract_modalities (organization_id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Locação de imóvel (exemplo)')
on conflict do nothing;
insert into public.system_settings (organization_id, key, value, description) values
  ('00000000-0000-4000-8000-000000000001', 'contracts.expiring_days', '90'::jsonb, 'Dias antes do fim da vigência para considerar o contrato "próximo do vencimento".')
on conflict (organization_id, key) do nothing;

-- -----------------------------------------------------------------------------
-- Regras de alerta de contratos (prazos configuráveis)
-- -----------------------------------------------------------------------------
insert into public.alert_rules (organization_id, code, days_before, description) values
  ('00000000-0000-4000-8000-000000000001', 'contract_expiring', 90, 'Contrato a 90 dias do fim da vigência'),
  ('00000000-0000-4000-8000-000000000001', 'contract_expiring', 60, 'Contrato a 60 dias do fim da vigência'),
  ('00000000-0000-4000-8000-000000000001', 'contract_expiring', 30, 'Contrato a 30 dias do fim da vigência'),
  ('00000000-0000-4000-8000-000000000001', 'contract_expired', 0, 'Contrato vencido'),
  ('00000000-0000-4000-8000-000000000001', 'contract_adjustment', 30, 'Data-base do contrato em até 30 dias (reajuste)')
on conflict (organization_id, code, days_before) do nothing;

-- -----------------------------------------------------------------------------
-- Financeiro: fornecedores e configurações padrão
-- -----------------------------------------------------------------------------
insert into public.suppliers (organization_id, name, kind) values
  ('00000000-0000-4000-8000-000000000001', 'Energisa', 'energy'),
  ('00000000-0000-4000-8000-000000000001', 'Iguá', 'water')
on conflict do nothing;
insert into public.system_settings (organization_id, key, value, description) values
  ('00000000-0000-4000-8000-000000000001', 'rents.due_day', '10'::jsonb, 'Dia de vencimento dos aluguéis gerados automaticamente (no próprio mês da competência).'),
  ('00000000-0000-4000-8000-000000000001', 'consumption.alert_percent', '30'::jsonb, 'Aumento de consumo, em %, sobre a média dos três meses anteriores que gera alerta para análise.')
on conflict (organization_id, key) do nothing;
insert into public.alert_rules (organization_id, code, days_before, description) values
  ('00000000-0000-4000-8000-000000000001', 'invoice_overdue', 0, 'Fatura vencida com saldo em aberto')
on conflict (organization_id, code, days_before) do nothing;
