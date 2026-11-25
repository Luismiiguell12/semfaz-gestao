-- =============================================================================
-- SEMFAZ Gestão — Catálogo de permissões (estrutura do sistema).
-- Movido do seed para migration: tabelas de outras migrations referenciam
-- permissões (ex.: approval_operations), e o seed roda depois das migrations.
-- Idempotente: atualiza descrições e marcação de privilégio.
-- =============================================================================
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

