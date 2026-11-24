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
