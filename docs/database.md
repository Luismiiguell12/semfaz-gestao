# Banco de dados

PostgreSQL 17 (Supabase). Toda alteração é feita por migration em
`supabase/migrations/`. Nunca altere o banco manualmente.

## Migrations da Fase 1

| Arquivo                                     | Conteúdo                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `20261124000100_foundation_extensions.sql`  | extensões (`citext`, `btree_gist`), schema `private`, enums, triggers utilitários (autoria, bloqueio de exclusão física)           |
| `20261124000200_organization_access.sql`    | `organizations`, `departments`, `profiles`, `permissions`, `roles`, `role_permissions`, `user_roles`, `user_department_access`     |
| `20261124000300_authorization_helpers.sql`  | funções de autorização, `has_permission`, `get_my_access`                                                                          |
| `20261124000400_audit.sql`                  | `audit_logs` imutável, trigger genérico de auditoria, auditoria de sessões                                                         |
| `20261124000500_settings_notifications.sql` | `system_settings`, `notification_types`, `notifications`, `notification_preferences`, `notification_email_queue`, `private.notify` |
| `20261124000600_documents.sql`              | bucket privado, `documents`, versionamento, políticas do Storage                                                                   |
| `20261124000700_rls_policies.sql`           | RLS de todas as tabelas, view `user_directory`, regras de proteção                                                                 |
| `20261124000800_admin_rpcs.sql`             | RPCs administrativas (usuários, perfis, departamentos, primeiro administrador)                                                     |
| `20261124000900_dashboard_foundation.sql`   | indicadores do painel da fundação                                                                                                  |

## Migrations da Fase 2

| Arquivo                                   | Conteúdo                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261125000050_permissions_catalog.sql`  | catálogo de permissões (movido do seed)                                                                                                                    |
| `20261125000100_approvals_engine.sql`     | `approval_operations`, `approval_rules`, `approval_requests`, `approval_steps`, `approval_decisions`, funções do motor                                     |
| `20261125000200_properties_landlords.sql` | `properties`, `user_property_access`, `landlords`, `property_landlords`, validação de CPF/CNPJ, operações de imóveis                                       |
| `20261125000300_contracts.sql`            | `contract_modalities`, `adjustment_indexes`, `contracts`, `contract_landlords`, `contract_amendments`, visão `contracts_overview`, documentos por registro |
| `20261125000400_alerts_dashboard.sql`     | `alert_rules`, `alerts`, rotina `pg_cron`, `dashboard_contract_stats`                                                                                      |

## Tabelas da Fase 2

| Tabela                | Observações                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `approval_requests`   | snapshot, dados propostos, `base_hash`, justificativa; uma pendente por operação/registro (exceto aditivos)                                   |
| `approval_decisions`  | imutável                                                                                                                                      |
| `properties`          | CEP `00000-000`, UF válida, unidade dentro da estrutura do responsável; criada só após aprovação                                              |
| `landlords`           | CPF/CNPJ com dígitos verificadores, único por organização; colunas mascaradas geradas; documento/telefone completos sem privilégio de leitura |
| `contracts`           | número único por organização; datas coerentes; `numeric(14,2)`                                                                                |
| `contract_amendments` | campos obrigatórios conforme o tipo; imutável após aprovação                                                                                  |
| `alerts`              | único por regra, registro e data do marco (sem duplicidade)                                                                                   |

## Tabelas

| Tabela                     | Finalidade                              | Observações                                                                                                         |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `organizations`            | prefeitura (raiz multi-organização)     | sem exclusão física                                                                                                 |
| `departments`              | secretaria → diretoria → unidade        | hierarquia validada por CHECK + trigger; FK composta com a organização; nome e sigla únicos por nível               |
| `profiles`                 | dados funcionais (1:1 com `auth.users`) | e-mail sincronizado com o Auth; `username` único; matrícula única por organização; `status` ativo/inativo/bloqueado |
| `permissions`              | catálogo global `modulo.acao`           | mantido por migration/seed; `is_privileged` exige MFA                                                               |
| `roles`                    | perfis de acesso configuráveis          | `admin` possui todas as permissões implicitamente; perfis do sistema não podem ser excluídos                        |
| `role_permissions`         | permissões de cada perfil               | vínculo; alterações auditadas                                                                                       |
| `user_roles`               | perfis de cada usuário                  | gera notificação ao usuário                                                                                         |
| `user_department_access`   | escopo por departamento                 | concede a subárvore                                                                                                 |
| `audit_logs`               | trilha de auditoria                     | somente inserção                                                                                                    |
| `system_settings`          | configurações por organização           | chave única por organização                                                                                         |
| `notification_types`       | catálogo de avisos                      | tipos de fases futuras ficam `is_available = false`                                                                 |
| `notifications`            | avisos internos                         | leitura apenas das próprias; `link_path` só aceita caminhos internos                                                |
| `notification_preferences` | preferências por tipo                   | e-mail preparado, não enviado nesta versão                                                                          |
| `notification_email_queue` | fila de e-mails futura                  | sem acesso pela API                                                                                                 |
| `documents`                | metadados de arquivos                   | nome UUID no Storage, SHA-256, versão, imutável após envio                                                          |

Tabelas previstas para a Fase 2 em diante, conforme a especificação:
`user_property_access` (depende de `properties`), imóveis, contratos,
aprovações, alertas, financeiro, demandas e produtividade.

## Funções RPC expostas (`public`)

| Função                                                                                                                                        | Quem pode                   | Descrição                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| `get_my_access()`                                                                                                                             | usuário autenticado         | perfil, papéis, permissões efetivas e situação do MFA          |
| `has_permission(permission, department_id)`                                                                                                   | usuário autenticado         | consulta para a interface                                      |
| `dashboard_foundation_stats()`                                                                                                                | usuário ativo               | indicadores da fundação (os de usuários só com `users.manage`) |
| `mark_notification_read(id)` / `mark_all_notifications_read()`                                                                                | usuário ativo               | somente as próprias                                            |
| `can_attach_document(type, id)`                                                                                                               | usuário ativo               | pré-verificação do envio                                       |
| `log_client_event(op, module, metadata)`                                                                                                      | usuário ativo               | somente `DOCUMENT_VIEW` e `PAGE_ERROR`                         |
| `admin_precheck_invite`, `admin_create_profile`, `admin_update_profile`, `admin_set_user_status`, `admin_set_user_access`, `admin_list_users` | `users.manage` + AAL2       | administração de usuários                                      |
| `admin_save_role`, `admin_delete_role`                                                                                                        | `roles.manage` + AAL2       | perfis de acesso                                               |
| `soft_delete_department`                                                                                                                      | `departments.manage` + AAL2 | exclusão lógica com justificativa                              |
| `service_register_document`                                                                                                                   | **somente service_role**    | registro transacional de documento (Edge Function)             |
| `bootstrap_first_admin`                                                                                                                       | **somente service_role**    | primeiro administrador (script local)                          |

## Seed

`supabase/seed.sql` é **estrutural e idempotente** (`on conflict`): organização
inicial, secretaria SEMFAZ, permissões, perfis padrão e suas permissões, tipos
de notificação e configurações. Aplicado por `supabase db reset` (local) e
`supabase db push --include-seed` (remoto). Não há dados de demonstração;
os testes criam dados fictícios dentro de transações ou com sufixos aleatórios.

## Tipos TypeScript

```bash
npm run db:types
```
