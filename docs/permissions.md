# Permissões e escopos

## Modelo

- **Permissão**: `modulo.acao` (catálogo em `public.permissions`).
- **Perfil de acesso** (`roles`): conjunto de permissões, configurável por administradores.
- **Escopo**: quais registros o usuário alcança.
  - Acesso a toda a organização (`profiles.organization_wide_access`, somente administradores concedem); ou
  - departamentos em `user_department_access`, que incluem as diretorias e unidades abaixo; ou
  - nas próximas fases: imóveis selecionados (`user_property_access`) e demandas em que participa.
- **MFA**: permissões `is_privileged` só valem em sessão AAL2 para administradores e para quem tem MFA ativo.

A interface oculta ações sem permissão, mas **a autorização real ocorre no banco**
(RLS, `private.has_permission` nas RPCs e nas Edge Functions).

## Perfis iniciais

| Permissão                                        | Administrador | Gestor | Colaborador | Consulta |
| ------------------------------------------------ | :-----------: | :----: | :---------: | :------: |
| users.manage 🔒                                  |       ✓       |        |             |          |
| roles.manage 🔒                                  |       ✓       |        |             |          |
| departments.manage 🔒                            |       ✓       |        |             |          |
| audit.view 🔒                                    |       ✓       |        |             |          |
| settings.manage 🔒                               |       ✓       |        |             |          |
| approvals.review 🔒                              |       ✓       |        |             |          |
| payments.approve 🔒                              |       ✓       |        |             |          |
| tasks.delete_any 🔒                              |       ✓       |        |             |          |
| properties.view                                  |       ✓       |   ✓    |      ✓      |    ✓     |
| properties.create / properties.update            |       ✓       |   ✓    |             |          |
| landlords.view                                   |       ✓       |   ✓    |      ✓      |    ✓     |
| landlords.manage                                 |       ✓       |   ✓    |             |          |
| landlords.view_sensitive                         |       ✓       |        |             |          |
| contracts.view                                   |       ✓       |   ✓    |      ✓      |    ✓     |
| contracts.manage / contracts.documents.view      |       ✓       |   ✓    |             |          |
| utilities.view                                   |       ✓       |   ✓    |      ✓      |    ✓     |
| utilities.manage                                 |       ✓       |   ✓    |             |          |
| invoices.view                                    |       ✓       |   ✓    |      ✓      |    ✓     |
| invoices.manage                                  |       ✓       |   ✓    |      ✓      |          |
| finance.documents.view                           |       ✓       |   ✓    |             |          |
| tasks.view_all                                   |       ✓       |   ✓    |             |          |
| tasks.create / tasks.complete / tasks.delete_own |       ✓       |   ✓    |      ✓      |          |
| tasks.categories.manage                          |       ✓       |   ✓    |             |          |
| productivity.view_own                            |       ✓       |   ✓    |      ✓      |    ✓     |
| productivity.view_team                           |       ✓       |   ✓    |             |          |
| reports.export                                   |       ✓       |   ✓    |             |          |

🔒 = privilegiada (exige MFA). As permissões das fases futuras já existem no
catálogo para que os perfis possam ser configurados com antecedência; elas só
têm efeito quando o módulo correspondente for implementado.

## Regras de proteção

| Regra                                                                                           | Onde é garantida                                                      |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Ninguém altera as próprias permissões, escopos ou situação                                      | triggers em `user_roles`, `user_department_access`, `profiles` + RPCs |
| Sempre existe pelo menos um administrador ativo                                                 | constraint triggers em `user_roles` e `profiles`                      |
| O perfil Administrador não é editável                                                           | trigger em `role_permissions` + `admin_save_role`                     |
| Não se concede perfil com permissões que o operador não possui                                  | `private.assert_can_manage_role`                                      |
| Somente administradores concedem/removem o perfil Administrador e o acesso a toda a organização | RPCs                                                                  |
| Usuário inativo/bloqueado não acessa nada                                                       | `private.is_active_user()` em todas as políticas e funções            |
| Toda alteração de perfil ou permissão é auditada                                                | triggers de auditoria                                                 |
