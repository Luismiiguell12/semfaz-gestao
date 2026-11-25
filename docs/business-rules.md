# Regras de negócio

Regras implementadas até a Fase 1. Regras das fases seguintes serão
acrescentadas aqui quando implementadas, sempre com a referência de onde são
garantidas no backend.

## Usuários e acesso

| Regra                                                                              | Implementação                                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Não há cadastro público; usuários entram por convite de um administrador           | `enable_signup = false`; Edge Function `admin-users`                 |
| Login pelo e-mail institucional; nome de usuário é identificador de exibição único | `profiles.email` sincronizado com o Auth; índice único em `username` |
| Matrícula é opcional e única por organização                                       | índice único parcial                                                 |
| Situações: ativo, inativo, bloqueado; mudança exige justificativa                  | `admin_set_user_status` + `set_justification`                        |
| Inativo ou bloqueado não acessa nada, mesmo com sessão aberta                      | RLS + banimento no Auth                                              |
| MFA obrigatório para administradores                                               | `private.mfa_requirement_met`; redirecionamento para `/mfa`          |
| Primeiro administrador somente por script local                                    | `bootstrap_first_admin` (service_role)                               |
| Recomenda-se ao menos dois administradores ativos                                  | alerta no painel quando há apenas um                                 |

## Estrutura organizacional

| Regra                                                                                                       | Implementação                              |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Secretaria não tem superior; diretoria fica abaixo de secretaria; unidade abaixo de secretaria ou diretoria | CHECK + `tg_validate_department_hierarchy` |
| Departamento superior da mesma organização                                                                  | FK composta                                |
| Exclusão lógica com justificativa; bloqueada se houver subordinados ou usuários lotados                     | `soft_delete_department` + trigger         |

## Aprovações

| Regra                                                                                                                                                     | Implementação                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Exigem aprovação (configurável): criar imóvel, alterar endereço ou secretaria do imóvel, cadastrar contrato, alterar valor ou vigência, cadastrar aditivo | `approval_operations` + `approval_rules` |
| O solicitante nunca decide a própria solicitação, mesmo sendo administrador                                                                               | `decide_approval`                        |
| Decisão em nível único pelo Administrador (`approvals.review`, com MFA)                                                                                   | `require_permission('approvals.review')` |
| Rejeição exige motivo e preserva os dados originais                                                                                                       | `decide_approval`                        |
| Efetivação transacional; bloqueada se o registro mudou desde a solicitação                                                                                | handlers + `assert_not_stale` (hash)     |
| Registro em criação não aparece como oficial antes da aprovação                                                                                           | o registro só é inserido pelo handler    |
| O solicitante pode cancelar a própria solicitação pendente                                                                                                | `cancel_approval_request`                |
| Com um único administrador ativo, solicitações dele ficam pendentes e o painel exibe alerta                                                               | `approval_reviewers` + painel            |

## Imóveis, locadores e contratos

| Regra                                                                                                                                            | Implementação                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Um imóvel pode ter vários contratos; contratos antigos não são sobrescritos                                                                      | FK sem unicidade; alterações via solicitação auditada    |
| Vigência efetiva = último aditivo de prazo aprovado, ou o fim original                                                                           | `private.contract_effective_end`                         |
| Valor vigente numa data = último aditivo de valor em vigor naquela data, ou o valor original                                                     | `private.contract_monthly_value_at`                      |
| Situação de vigência calculada (não iniciado, vigente, próximo do vencimento, vencido) no fuso de Maceió; "próximo" = até 90 dias (configurável) | `contracts_overview` + `contracts.expiring_days`         |
| O sistema não calcula reajustes; apenas alerta sobre a data-base                                                                                 | `alert_rules` (contract_adjustment)                      |
| Com mais de um locador, percentuais obrigatórios e soma 100%                                                                                     | `assert_landlord_shares`                                 |
| Dados bancários de locadores não são armazenados                                                                                                 | ausência de colunas                                      |
| CPF/telefone completos só com `landlords.view_sensitive`, com registro na auditoria                                                              | `get_landlord_sensitive`                                 |
| Alertas: 90/60/30 dias antes, vencido e data-base; diários, sem duplicidade                                                                      | `generate_contract_alerts` + `pg_cron` + `alerts_unique` |

## Documentos

| Regra                                                                  | Implementação                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tipos permitidos: PDF, JPG, PNG, DOCX, XLSX, verificados pelo conteúdo | `documents-upload` (assinatura binária) + CHECK de `mime_type` + bucket                   |
| Tamanho máximo configurável (padrão 10 MB)                             | `system_settings.documents.max_file_size_mb`, Edge Function e `service_register_document` |
| Nome no Storage gerado pelo sistema (UUID)                             | Edge Function; CHECK de formato em `storage_path`                                         |
| Documentos não são apagados; substituição gera nova versão             | sem política de DELETE; `previous_version_id`, `is_current`; metadados imutáveis          |
| Acesso segue o registro associado                                      | `can_access_document_entity` + política de `storage.objects`                              |

## Auditoria e histórico

| Regra                                                                                    | Implementação                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------- |
| Toda alteração em tabela de negócio é registrada com autor, antes/depois e justificativa | `private.tg_audit`                 |
| Logins, logouts e verificação de MFA são registrados                                     | trigger em `auth.sessions`         |
| Registros de auditoria não podem ser alterados nem apagados                              | revogação de privilégios + trigger |
| Registros de negócio não são apagados fisicamente                                        | `tg_prevent_physical_delete`       |

## Datas, horários e valores

- Instantes em UTC (`timestamptz`), exibidos em America/Maceio (UTC−3, sem horário de verão).
- Datas de calendário em `date`, exibidas sem conversão de fuso.
- Valores monetários: `numeric(14,2)` no banco; o frontend apenas formata (R$), sem cálculos.
