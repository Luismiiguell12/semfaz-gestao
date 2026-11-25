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
| consumer_units.view                              |       ✓       |   ✓    |      ✓      |    ✓     |
| consumer_units.manage                            |       ✓       |   ✓    |             |          |
| invoices.view                                    |       ✓       |   ✓    |      ✓      |    ✓     |
| invoices.manage                                  |       ✓       |   ✓    |      ✓      |          |
| finance.documents.view                           |       ✓       |   ✓    |             |          |
| finance.reports.view                             |       ✓       |   ✓    |      ✓      |    ✓     |
| tasks.view_all                                   |       ✓       |   ✓    |             |          |
| tasks.create / tasks.complete / tasks.delete_own |       ✓       |   ✓    |      ✓      |          |
| tasks.categories.manage                          |       ✓       |   ✓    |             |          |
| productivity.view_own                            |       ✓       |   ✓    |      ✓      |    ✓     |
| productivity.view_team                           |       ✓       |   ✓    |             |          |
| reports.export                                   |       ✓       |   ✓    |             |          |

🔒 = privilegiada (exige MFA). As permissões das fases futuras já existem no
catálogo para que os perfis possam ser configurados com antecedência; elas só
têm efeito quando o módulo correspondente for implementado.

## Alteração 01

- `consumer_units.view` / `consumer_units.manage` substituem `utilities.view` / `utilities.manage`
  (unidades consumidoras passaram ao grupo Gestão). A migration concedeu as novas aos **mesmos** perfis
  que tinham as antigas, inclusive perfis criados pelos administradores; nenhum acesso foi ampliado ou reduzido.
- `finance.reports.view` (Relatórios de despesas) foi concedida aos perfis que já viam os indicadores
  financeiros (`invoices.view`). A exportação exige também `reports.export` (Fase 6).
- O cadastro guiado exige `contracts.manage`; conforme o pacote, também `properties.create` (imóvel novo)
  e `consumer_units.manage` (unidades), sempre no escopo da secretaria do imóvel.

## Fase 4 (demandas)

As permissões de demandas, já presentes no catálogo, passaram a ter efeito:
`tasks.create` (criar demandas e eventos), `tasks.complete` (concluir), `tasks.view_all` (acompanhar e
editar as demandas da secretaria no escopo), `tasks.delete_own` (criador solicita exclusão),
`tasks.delete_any` (exclusão excepcional, privilegiada) e `tasks.categories.manage` (categorias).
Quem participa de uma demanda sempre a vê, mesmo sem permissões de demandas.

## Fase 5 (produtividade)

`productivity.view_own` (todos os perfis iniciais) dá acesso aos próprios indicadores;
`productivity.view_team` (Gestor e Administrador) aos indicadores das pessoas do escopo de departamentos de
quem consulta (perfil ou acesso a departamento). Indicadores de produtividade são dados pessoais.

## Fase 6 (relatórios)

`reports.export` (Gestor e Administrador) libera os botões Excel/PDF e a Edge Function `reports-export`.
Cada relatório exige também a permissão de consulta do seu módulo: `properties.view` (Imóveis),
`contracts.view` (Contratos, vencimentos e Aditivos), `invoices.view` (água, energia, faturas pendentes,
aluguéis e pagamentos), `finance.reports.view` (despesas) e `productivity.view_own` (Produtividade).
Demandas e Aprovações seguem a visibilidade já existente desses módulos. A prévia na tela não exige
`reports.export`; em todos os casos a RLS limita as linhas ao escopo do usuário.

## Fase 7 (segurança)

Duas barreiras independentes: a RLS (quem vê quais linhas) e os privilégios dos papéis da API (que
comandos existem). Usuários não têm `DELETE` nem `TRUNCATE` em nenhuma tabela (exclusão sempre lógica,
por função com aprovação) e só escrevem diretamente em 9 tabelas de configuração; visões são somente
leitura. O teste de integração `api-attack` tenta ler, inserir, alterar e apagar em **todas** as tabelas
e visões publicadas pela API, como anônimo, usuário sem perfil, Consulta e Colaborador.

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
