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

## Cadastro a partir do contrato (Alteração 01)

Fluxo real da SEMFAZ: o contrato chega → cadastra-se o locador → o imóvel → as unidades consumidoras.

| Regra                                                                                                                                                            | Implementação                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Rascunho salvo no banco a cada etapa, visível e editável só pelo autor                                                                                           | `registration_drafts` + RLS                            |
| CPF/CNPJ já cadastrado: o sistema oferece o cadastro existente (sem duplicar)                                                                                    | `find_landlord_by_document` + `save_landlord`          |
| Locador novo é gravado na hora (não exige aprovação) e permanece mesmo se o pacote for rejeitado                                                                 | `save_landlord`                                        |
| Imóvel com o mesmo CEP e número gera aviso (os de fora do escopo aparecem só na contagem)                                                                        | `find_similar_properties`                              |
| Unidade já cadastrada em outro imóvel: transferência encerra o vínculo anterior na véspera e preserva o histórico; fora do escopo, só um administrador transfere | `find_consumer_unit`, `write_registration_package`     |
| Data de vinculação sugerida = início da vigência; endereço do imóvel sugerido para a Iguá                                                                        | interface do assistente                                |
| Imóvel novo + contrato + locadores (do contrato e do imóvel) + unidades = **uma** solicitação                                                                    | `submit_registration_package` → `registration.package` |
| Envio valida o pacote inteiro com as regras reais do banco, sem gravar                                                                                           | subtransação desfeita                                  |
| Aprovação: tudo ou nada; rejeição: nada do pacote é criado; autoaprovação bloqueada                                                                              | `decide_approval` + `apply_registration_package`       |
| Na efetivação, os locadores do imóvel passam a ser os do contrato (anteriores encerrados com motivo)                                                             | `write_registration_package`                           |
| Rascunho rejeitado, cancelado ou não efetivado pode ser reaberto e corrigido                                                                                     | `reopen_registration_draft`                            |
| Valor global sugerido = valor mensal × meses completos + dias restantes proporcionais; o usuário confirma                                                        | `modules/contracts/suggest.ts`                         |

## Relatórios de despesas (Alteração 01)

| Regra                                                                                                                       | Implementação                       |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Base competência (padrão): cada despesa pelo mês de competência; base pagamento: pagamentos aprovados pelo mês do pagamento | `private.expense_rows`              |
| Canceladas ficam fora; estornos são abatidos                                                                                | `expense_items` + `expense_rows`    |
| Aluguel com vários locadores é distribuído pelo percentual de participação                                                  | `private.contract_landlord_factors` |
| Comparativo com o mesmo período do ano anterior (R$ e %), quando houver dados                                               | `expense_report`                    |
| Tudo com a RLS do usuário; Painel usa a mesma base                                                                          | `security invoker`                  |
| Período máximo de 60 meses                                                                                                  | `expense_report`                    |
| Exportação Excel/PDF: pendência da Fase 6 (mecanismo auditado de exportações)                                               | —                                   |

## Financeiro

| Regra                                                                                                                                      | Implementação                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Unidade consumidora é cadastrada já vinculada a um imóvel; transferência encerra o vínculo anterior                                        | `save_consumer_unit`, `assign_consumer_unit`        |
| Períodos de vínculo não se sobrepõem; vínculo encerrado não muda                                                                           | constraint de exclusão + trigger                    |
| A fatura pertence ao imóvel vinculado à unidade na competência                                                                             | `create_invoice`                                    |
| Fatura duplicada na competência só com justificativa e aprovação                                                                           | `create_invoice` → `invoice.duplicate`              |
| Aluguel mensal gerado automaticamente; mês parcial = valor mensal ÷ dias do mês × dias, por período de valor, arredondado (meio para cima) | `private.rent_calculation`, `generate_rent_charges` |
| Vencimento dos aluguéis: dia 10 da competência (configurável)                                                                              | `rents.due_day`                                     |
| Pagamento e estorno só via aprovação; registros imutáveis; não pode exceder o saldo                                                        | `request_payment` → `payment.register`              |
| Situação calculada (pendente, parcialmente paga, paga, vencida, cancelada); comprovante anexado não marca como paga                        | `private.charge_status`                             |
| Alerta de consumo acima de 30% (configurável) da média dos 3 meses anteriores; sem 3 meses, "histórico insuficiente"                       | `consumption_records`, `consumption.alert_percent`  |
| Rotina diária às 6h05 de Maceió: aluguéis do mês e alertas de fatura vencida                                                               | `pg_cron` `semfaz-finance-daily`                    |

## Demandas e calendário (Fase 4)

| Regra                                                                                                                                   | Implementação                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Criador gravado pelo banco (`auth.uid()`), nunca aceito do cliente                                                                      | `tg_set_actor_columns`                                         |
| Vê a demanda: criador, responsável, participantes; e quem tem `tasks.view_all` no escopo da secretaria da demanda                       | `can_view_task` + RLS                                          |
| Edita dados: criador, responsável ou gestor do escopo; participantes mudam status, comentam e anexam                                    | `can_edit_task`, `can_work_task`                               |
| Concluir exige `tasks.complete`; cancelar e reabrir só quem edita; cancelamento exige motivo                                            | `set_task_status`                                              |
| Toda mudança de status vai para `task_status_history`; conclusão registra quem e quando                                                 | triggers                                                       |
| Atrasada = prazo (data e, se houver, horário de Maceió) passado e status diferente de concluída/cancelada; o status não muda sozinho    | `tasks_overview.is_overdue`                                    |
| Urgência (Baixa, Média, Alta, Crítica) e prioridade (Baixa, Normal, Alta, Urgente) independentes; complexidade sem pontuação            | enums                                                          |
| Comentários não são editados nem apagados                                                                                               | trigger de imutabilidade                                       |
| Exclusão: só o criador solicita; administrador pode pedir exclusão excepcional; sempre aprovação por outro administrador; sempre lógica | `task.delete`, `task.delete_exceptional`, `approval_mandatory` |
| Avisos de prazo próximo (padrão 2 dias, configurável em `tasks.due_soon_days`) e atraso, uma vez por pessoa                             | `generate_task_reminders`                                      |
| Eventos: vistos pelo criador, participantes do evento e por quem vê a demanda vinculada; cancelamento com motivo, sem exclusão física   | `can_view_task_event`, `cancel_task_event`                     |

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
