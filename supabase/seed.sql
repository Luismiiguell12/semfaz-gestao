-- =============================================================================
-- SEMFAZ Gestão — Seed ESTRUTURAL (idempotente)
-- Contém somente dados estruturais: organização, perfis de acesso, permissões,
-- tipos de notificação e configurações padrão. Nenhum dado pessoal ou fictício.
-- Aplicado localmente por `supabase db reset` e nos ambientes remotos por
-- `supabase db push --include-seed` (workflow de migrations).
-- Itens das fases seguintes (categorias, regras de alerta e de aprovação,
-- fornecedores) serão adicionados junto com suas tabelas.
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

-- -----------------------------------------------------------------------------
-- Catálogo de permissões (módulo.ação). is_privileged = exige MFA (AAL2).
-- -----------------------------------------------------------------------------
insert into public.permissions (code, module, description, is_privileged) values
  -- Administração (Fase 1)
  ('users.manage',               'users',         'Cadastrar, convidar, editar e desativar usuários', true),
  ('roles.manage',               'permissions',   'Criar e editar perfis de acesso e suas permissões', true),
  ('departments.manage',         'departments',   'Cadastrar e editar a estrutura organizacional', true),
  ('audit.view',                 'audit',         'Consultar a trilha de auditoria', true),
  ('settings.manage',            'settings',      'Alterar configurações do sistema', true),
  -- Imóveis e locações (Fase 2)
  ('properties.view',            'properties',    'Consultar imóveis no escopo do usuário', false),
  ('properties.create',          'properties',    'Solicitar o cadastro de imóveis', false),
  ('properties.update',          'properties',    'Editar imóveis e solicitar alterações sensíveis', false),
  ('landlords.view',             'properties',    'Consultar locadores', false),
  ('landlords.manage',           'properties',    'Cadastrar e editar locadores', false),
  ('landlords.view_sensitive',   'properties',    'Ver CPF e telefone completos de locadores', false),
  ('contracts.view',             'contracts',     'Consultar contratos e aditivos', false),
  ('contracts.manage',           'contracts',     'Solicitar cadastro e alterações de contratos e aditivos', false),
  ('contracts.documents.view',   'contracts',     'Consultar documentos contratuais', false),
  -- Unidades consumidoras e financeiro (Fase 3)
  ('utilities.view',             'utilities',     'Consultar unidades consumidoras', false),
  ('utilities.manage',           'utilities',     'Cadastrar unidades consumidoras e vínculos', false),
  ('invoices.view',              'finance',       'Consultar faturas e aluguéis', false),
  ('invoices.manage',            'finance',       'Lançar faturas e solicitar pagamentos', false),
  ('finance.documents.view',     'finance',       'Consultar documentos financeiros e comprovantes', false),
  ('payments.approve',           'finance',       'Aprovar movimentações financeiras', true),
  -- Demandas e calendário (Fase 4)
  ('tasks.view_all',             'tasks',         'Consultar demandas de todo o escopo', false),
  ('tasks.create',               'tasks',         'Criar demandas', false),
  ('tasks.complete',             'tasks',         'Concluir demandas', false),
  ('tasks.delete_own',           'tasks',         'Solicitar exclusão das próprias demandas', false),
  ('tasks.delete_any',           'tasks',         'Autorizar exclusões excepcionais de demandas', true),
  ('tasks.categories.manage',    'tasks',         'Criar categorias de demandas', false),
  -- Aprovações (Fase 2)
  ('approvals.review',           'approvals',     'Aprovar ou rejeitar solicitações', true),
  -- Produtividade (Fase 5)
  ('productivity.view_own',      'productivity',  'Ver os próprios indicadores', false),
  ('productivity.view_team',     'productivity',  'Ver indicadores da equipe', false),
  -- Relatórios (Fase 6)
  ('reports.export',             'reports',       'Exportar relatórios (Excel/PDF)', false)
on conflict (code) do update
  set module = excluded.module, description = excluded.description, is_privileged = excluded.is_privileged;

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
  ('contract_expiring',     'contracts',  'Vencimento contratual', false),
  ('contract_adjustment',   'contracts',  'Reajuste contratual (data-base)', false),
  ('invoice_overdue',       'finance',    'Fatura vencida', false),
  ('consumption_alert',     'finance',    'Alerta de consumo', false),
  ('approval_pending',      'approvals',  'Aprovação pendente', false),
  ('approval_approved',     'approvals',  'Solicitação aprovada', false),
  ('approval_rejected',     'approvals',  'Solicitação rejeitada', false)
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
