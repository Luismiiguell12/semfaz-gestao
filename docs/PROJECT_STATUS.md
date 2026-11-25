# Status do projeto — SEMFAZ Gestão

> Leia este arquivo no início de cada sessão de trabalho.

## Fase atual

**Fase 6 — Relatórios e exportações: concluída, aguardando validação.** A Fase 5 foi validada pelo responsável ("vamos para a fase 6"). Próxima atividade, após a validação: **Fase 7 (testes finais, homologação/produção e publicação)**.

## Funcionalidades concluídas (Fase 6)

- **6A Catálogo de relatórios:** 13 relatórios com filtros (Gestão: Imóveis, Contratos, Contratos próximos do vencimento, Aditivos; Financeiro: Despesas de água, Despesas de energia, Faturas pendentes, Aluguéis, Pagamentos, Relatório de despesas (lançamentos); Acompanhamento: Demandas, Produtividade, Aprovações). Catálogo único (`supabase/functions/_shared/reports/catalog.ts`) usado pela prévia na tela e pela geração do arquivo.
- **6B Exportação Excel e PDF:** Edge Function `reports-export` com o **token do próprio usuário** (RLS e verificações das RPCs valem como na tela, nunca service role); exige `reports.export` e a permissão do relatório; limite de 5.000 linhas por arquivo; cabeçalho com órgão, título, filtros, autor e data/hora de Maceió; produtividade leva o aviso de uso.
- **6C Auditoria antes da entrega:** `log_report_export` grava em `audit_logs` (operação `EXPORT`): quem, relatório, filtros, formato, quantidade de linhas e quando. Se o registro falhar, o arquivo não é devolvido.
- **6D Telas:** página Relatórios (menu Acompanhamento) com catálogo por grupo, filtros, prévia das 100 primeiras linhas e botões Excel/PDF para quem tem `reports.export`; exportação habilitada também em **Relatórios de despesas** (pendência da Alteração 01) e em **Produtividade**.

## Funcionalidades concluídas (Fase 5)

- **5A Métricas:** recebidas, concluídas, concluídas no prazo, pendentes e atrasadas ao fim do período, percentual de conclusão, cumprimento de prazos, tempo médio de execução, distribuição por complexidade (contagem) e participação (responsável/participante), por mês, trimestre, semestre e ano (datas de Maceió). Sem pontos, pesos nem rankings.
- **5B Visibilidade:** cada pessoa vê os próprios indicadores (`productivity.view_own`); a equipe apenas com `productivity.view_team`, restrita ao escopo de departamentos de quem consulta.
- **5C Consolidação:** `productivity_snapshots` gravados todo dia 1º (06h20 de Maceió) para os períodos que fecharam; registros imutáveis; períodos fechados usam o registro consolidado.
- **5D Telas e painel:** página Produtividade (período, pessoa, secretaria, cartões, evolução, complexidade, coletivo e tabela por pessoa em ordem alfabética) com o aviso de que os indicadores não são avaliação automática; painel com "Minha produtividade no mês" e "Produtividade por colaborador" para quem vê a equipe.

## Funcionalidades concluídas (Fase 4)

- **4A Demandas:** título, descrição, solicitante (usuário ou nome externo), criador gravado pelo banco, responsável principal, participantes, categoria, secretaria, início, prazo e horário, urgência e prioridade independentes, complexidade e status; escrita somente por RPC com verificação de acesso; histórico de status em `task_status_history`; registro de quem concluiu e quando; atraso calculado pelo prazo (Maceió) sem mudar o status.
- **4B Colaboração:** comentários imutáveis, anexos (documentos com `entity_type = 'task'`), histórico; notificações de nova demanda, troca de responsável, comentário, conclusão, revisão, prazo próximo e atraso (rotina diária, sem repetição).
- **4C Exclusão:** somente lógica e sempre por aprovação (`task.delete` pelo criador; `task.delete_exceptional` por administrador), decidida por outro administrador; a obrigatoriedade não pode ser desativada nas regras.
- **4D Calendário:** eventos (reunião, compromisso, prazo, lembrete) com participantes, vinculados ou não a uma demanda; visões mensal, semanal e diária com prazos de demandas e eventos.
- **4E Telas e painel:** lista com filtros, kanban com arrastar (mouse, toque e teclado, com alternativa "Mover para"), detalhe com abas, categorias; painel com demandas abertas, em andamento, concluídas, atrasadas, por status e próximos compromissos.

## Alteração 01 (aplicada)

- Cadastro guiado a partir do contrato (Gestão): 5 etapas, rascunho no banco visível só para o autor, uma única solicitação de aprovação para imóvel novo + contrato + locadores + unidades, efetivação tudo ou nada.
- Integração entre cadastros: ficha do locador; ficha do imóvel com contratos atual/anteriores, aditivos e unidades atuais/histórico; contrato com endereço/secretaria do imóvel e sugestão de valor global; fatura com imóvel, fornecedor, secretaria e unidade de medida preenchidos; aluguel com imóvel, locadores e secretaria; nomes relacionados como links.
- Menu reorganizado (Gestão, Financeiro, Acompanhamento); unidades consumidoras na Gestão com permissões próprias `consumer_units.view/manage` (mesmos perfis de antes).
- Financeiro: telas Pagamentos e Relatórios de despesas (filtros, cartões, tabelas, comparativo anual, consumo, gráficos e detalhamento); Painel usa a mesma base de despesas.

## Funcionalidades concluídas (Fase 3)

- **3A Fornecedores e unidades consumidoras:** Energisa (energia) e Iguá (água) no seed; unidade com número da UC/matrícula único por fornecedor; cadastro já vinculado a um imóvel; histórico de vínculos com períodos que não se sobrepõem (constraint de exclusão) e vínculos encerrados imutáveis; transferência entre imóveis com justificativa.
- **3B Faturas:** lançamento manual; imóvel e unidade de medida derivados do vínculo na competência; duplicidade na mesma competência só com justificativa e aprovação; correção e cancelamento via aprovação.
- **3C Aluguéis:** geração automática e idempotente das competências a partir dos contratos aprovados, com proporcionalidade no primeiro e último mês e memória de cálculo; correção e cancelamento via aprovação.
- **3D Pagamentos:** pagamentos parciais e estornos como registros independentes e imutáveis, sempre via aprovação; situação (pendente, parcialmente paga, paga, vencida, cancelada) calculada no banco; anexar comprovante não marca como pago.
- **3E Consumo e alertas:** comparação com a média dos três meses anteriores (alerta acima de 30%, configurável); "histórico insuficiente" quando não há três meses; rotina diária (`pg_cron`) de geração de aluguéis e alertas de fatura vencida.
- **3F Telas:** Unidades consumidoras, Faturas (lista, lançamento, detalhe com pagamentos, dados, documentos e histórico), Aluguéis; abas de unidades/faturas no imóvel e de aluguéis no contrato; indicadores financeiros e gráficos de gastos mensais (aluguel, água, energia) e por imóvel no painel, com tabela acessível.

## Funcionalidades concluídas (Fase 2)

- **2A Motor de aprovações:** solicitação com snapshot, dados propostos e justificativa; decisão em nível único por administrador diferente do solicitante (AAL2); efetivação transacional por função no banco; bloqueio da efetivação quando o registro mudou desde a solicitação (hash do conteúdo); cancelamento pelo solicitante; regras configuráveis (`approval_rules`); etapas multinível preparadas (`approval_steps`); notificações de pendência, aprovação e rejeição.
- **2B Imóveis e locadores:** cadastro e alteração de endereço/secretaria via aprovação; demais campos com edição direta auditada; locadores com CPF/CNPJ validados no banco, mascarados por padrão e consulta completa restrita e auditada (sem dados bancários); vínculo N:N com percentuais; escopo por imóvel selecionado (`user_property_access`).
- **2C Contratos e aditivos:** cadastro, alteração de valor e de vigência via aprovação; aditivos aprovados e imutáveis; vigência e valor vigentes calculados (contrato + aditivos aprovados), sem sobrescrever o contrato; listas configuráveis de modalidade e índice de reajuste; documentos de imóveis, contratos, aditivos e solicitações.
- **2D Alertas:** regras configuráveis (90/60/30 dias, vencido, data-base) e rotina diária às 6h de Maceió (`pg_cron`), sem duplicidade, com notificação ao gestor, ao fiscal e aos administradores.
- **2E Telas:** Central de Aprovações, Imóveis, Locadores, Contratos, Regras e listas, escopo por imóveis na tela de usuários e indicadores do painel.

## Funcionalidades concluídas (Fase 1)

- **1A Base técnica:** Next.js 16 + TypeScript estrito + Tailwind 4 + componentes shadcn/ui; exportação estática com `basePath`; ESLint e Prettier; Vitest, pgTAP e Playwright; workflows de CI, Pages e migrations; `.env.example`; documentação.
- **1B Banco e segurança:** 9 migrations; funções de autorização; RLS em 100% das tabelas; auditoria por triggers; infraestrutura de documentos (bucket privado, metadados, versionamento, políticas); infraestrutura de notificações; seed estrutural.
- **1C Autenticação e administração:** login, logout, recuperação e definição de senha; convite por Edge Function; MFA TOTP obrigatório para administradores; script do primeiro administrador; departamentos; usuários (perfis, escopos, situação); perfis de acesso e permissões; consulta à auditoria.
- **1D Layout e identidade:** shell com sidebar recolhível e gaveta no celular, cabeçalho, breadcrumbs, menu do usuário e notificações; componentes reutilizáveis; painel inicial com indicadores disponíveis e estado vazio.

## Em andamento

- Nada. Aguardando a validação da Fase 6.

## Pendentes (próximas fases)

- Fase 7: testes finais, projetos de homologação/produção e publicação.

## Decisões técnicas

| #   | Decisão                                                                                                                                     | Motivo                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | TypeScript 6.0.3 em vez do 7.x                                                                                                              | o 7.x (compilador nativo) é recente e com compatibilidade incerta com o ecossistema do Next/ESLint                                                                 |
| 2   | Componentes shadcn/ui escritos no padrão oficial sobre `radix-ui`                                                                           | o host `ui.shadcn.com` estava bloqueado no ambiente de desenvolvimento; o resultado é o mesmo (código-fonte no projeto)                                            |
| 3   | Funções de autorização no schema `private`                                                                                                  | não ficam expostas como RPC; políticas e RPCs as usam                                                                                                              |
| 4   | Perfil `admin` com todas as permissões de forma implícita e não editável                                                                    | evita perda acidental de acesso administrativo e cobre permissões de módulos futuros                                                                               |
| 5   | Permissões privilegiadas (`is_privileged`) exigem AAL2                                                                                      | implementa "MFA obrigatório para administradores" no backend, não só na interface                                                                                  |
| 6   | Bloqueio duplo de usuário inativo: RLS + banimento no Supabase Auth                                                                         | RLS nega dados imediatamente; o banimento impede novo login e renovação de sessão                                                                                  |
| 7   | Envio de documentos só pela Edge Function, com service role após autorização                                                                | a verificação do tipo real exige ler o arquivo no servidor; o upload direto pelo navegador permitiria burlar a validação                                           |
| 8   | Departamentos podem receber documentos                                                                                                      | tipo de registro disponível na Fase 1 para validar a infraestrutura genérica; imóveis, contratos etc. entram nas próximas fases                                    |
| 9   | Schemas Zod em `supabase/functions/_shared/schemas` importados pelo frontend (`@shared/*`)                                                  | fonte única de validação para cliente e Edge Functions                                                                                                             |
| 10  | Fluxo de autenticação `implicit` no `supabase-js`                                                                                           | compatível com convites gerados pelo administrador (sem `code_verifier` no navegador)                                                                              |
| 11  | `permissions` e `notification_types` sem `organization_id`                                                                                  | catálogos globais mantidos por migration, não são dados de negócio                                                                                                 |
| 12  | Tabelas de vínculo (`user_roles`, `role_permissions`, `user_department_access`) aceitam remoção física                                      | são configuração de acesso, não registros de negócio; toda remoção é auditada com os dados anteriores                                                              |
| 13  | Seed estrutural idempotente aplicado também nos ambientes remotos (`db push --include-seed`)                                                | perfis e permissões são necessários em produção                                                                                                                    |
| 14  | Formatação de datas com `Intl` (America/Maceio); date-fns adiado para a Fase 4                                                              | a fundação não precisa de cálculos de data; evita dependência ociosa                                                                                               |
| 15  | Fila `notification_email_queue` sem envio                                                                                                   | arquitetura de e-mail preparada, conforme o escopo                                                                                                                 |
| 16  | Fonte Public Sans auto-hospedada                                                                                                            | identidade institucional sem CDN externo (compatível com a CSP)                                                                                                    |
| 17  | Indicadores do painel em função SQL (`dashboard_foundation_stats`)                                                                          | cálculo no banco respeitando permissões                                                                                                                            |
| 18  | Situação de faturas e aluguéis calculada em visões (`invoices_overview`, `rent_charges_overview`), nunca gravada                            | evita divergência entre pagamentos aprovados e o status exibido                                                                                                    |
| 19  | Pagamentos e estornos imutáveis, criados somente pela aprovação `payment.register`                                                          | trilha financeira completa; estorno não apaga o pagamento original                                                                                                 |
| 20  | Unidade consumidora nasce vinculada a um imóvel (mesma transação)                                                                           | o escopo de acesso é derivado do imóvel; sem vínculo, a unidade ficaria invisível para quem a cadastrou                                                            |
| 21  | Gráficos com Recharts (colunas por mês, sem eixo duplo) e tabela de dados equivalente                                                       | leitura acessível e consistente com a identidade visual                                                                                                            |
| 22  | Dados estruturais novos entram por migration idempotente, não só pelo seed                                                                  | nos ambientes remotos o `db push --include-seed` executa o seed apenas na primeira vez; alterações posteriores só atualizam o hash (corrigido em `20261125000800`) |
| 23  | Cadastro guiado como operação de aprovação própria (`registration.package`) com função de gravação única usada na validação e na efetivação | garante que o que foi validado no envio é exatamente o que se efetiva, tudo ou nada                                                                                |
| 24  | Rascunho guarda a interface (`data.ui`) e o pacote normalizado; só ids de locadores, nunca CPF/CNPJ                                         | retomada fiel do preenchimento sem dados pessoais no rascunho                                                                                                      |
| 25  | Arquivo do contrato anexado à solicitação após o envio                                                                                      | o rascunho não é registro de negócio; reaproveita documentos de solicitações já existentes                                                                         |
| 26  | Permissões `utilities.*` substituídas por `consumer_units.*` reescrevendo as funções existentes por migration (troca literal dos códigos)   | mesmo comportamento, sem copiar corpos longos à mão; teste garante que nenhuma referência antiga restou                                                            |
| 27  | Base única `expense_items` + `private.expense_rows` para relatórios e Painel                                                                | um só cálculo para todas as telas, com RLS do usuário                                                                                                              |
| 28  | Custo declarado nas funções de autorização (`cost 1000/200`)                                                                                | o planejador deixava de reavaliá-las a cada volta de nested loop; visões financeiras 10 a 16 vezes mais rápidas                                                    |
| 29  | Detalhamento dos relatórios em página própria (`/financeiro/relatorios/lancamentos/`)                                                       | um mesmo total pode misturar faturas e aluguéis; a página lista ambos com os mesmos filtros                                                                        |
| 30  | Anexos de demandas pela infraestrutura de documentos (`entity_type = 'task'`) em vez de tabela `task_attachments` própria                   | mesma validação de tipo/tamanho, versionamento e URL assinada já auditados                                                                                         |
| 31  | `task_deletion_requests` como visão sobre a Central de Aprovações                                                                           | um único motor de aprovação; a visão mantém o nome previsto na modelagem                                                                                           |
| 32  | Coluna `approval_operations.approval_mandatory` + trigger em `approval_rules`                                                               | "não existe exclusão imediata": a regra da organização não pode dispensar a aprovação                                                                              |
| 33  | Visibilidade: criador, responsável e participantes sempre; `tasks.view_all` no escopo da secretaria da demanda                              | segue "demandas das quais participa" e permite acompanhamento por gestores                                                                                         |
| 34  | `task_assignees.participation_weight` reservado (nulo)                                                                                      | pontuação adiada; a modelagem já recebe pesos sem migração destrutiva                                                                                              |
| 35  | Kanban com `@dnd-kit/core`                                                                                                                  | arrastar com mouse, toque e teclado (com anúncios para leitor de tela); arrastar nativo do HTML não funciona no celular                                            |
| 36  | Calendário próprio (sem biblioteca), datas como texto AAAA-MM-DD e fuso fixo -03:00                                                         | America/Maceio não tem horário de verão; evita dependência e erros de fuso do navegador                                                                            |
| 37  | Contêineres com rolagem horizontal recebem `position: relative`                                                                             | textos ocultos para leitores de tela (`sr-only`) escapavam do recorte e geravam rolagem da página no celular                                                       |
| 38  | Métricas calculadas no banco (`productivity_metrics`, só acessível pelas RPCs)                                                              | uma única definição para tela, painel e consolidação; ninguém consulta métricas de outra pessoa sem a verificação de escopo                                        |
| 39  | Períodos fechados lidos de `productivity_snapshots` (imutável)                                                                              | números estáveis mesmo se demandas forem corrigidas ou excluídas depois                                                                                            |
| 40  | Equipe em ordem alfabética, sem ordenar por desempenho                                                                                      | a especificação proíbe rankings nesta versão                                                                                                                       |
| 41  | Coletivo = soma das pessoas (participação conta uma vez por pessoa)                                                                         | evita dividir demandas entre participantes, o que dependeria dos pesos adiados                                                                                     |
| 42  | Catálogo de relatórios compartilhado entre navegador e Edge Function (`_shared/reports/catalog.ts`)                                         | a prévia e o arquivo usam exatamente a mesma consulta e os mesmos filtros, sempre com o cliente do usuário                                                         |
| 43  | PDF com `pdf-lib` 1.17.1 (JavaScript puro, fontes padrão WinAnsi) e Excel com ExcelJS 4.4.0                                                 | ambos rodam no Deno do Supabase sem binários nativos nem navegador; caracteres fora do WinAnsi (raros em pt-BR) são substituídos no PDF                            |
| 44  | Limite de 5.000 linhas por exportação (erro orientando a restringir filtros)                                                                | mantém a função dentro do tempo e da memória do plano gratuito                                                                                                     |
| 45  | Registro da exportação pelo próprio usuário (`log_report_export`, `security definer` com `reports.export`) antes de gerar o arquivo         | a auditoria fica vinculada ao usuário real, sem service role; sem registro não há arquivo                                                                          |
| 46  | Exportação dos Relatórios de despesas pelo relatório "lançamentos" (base competência)                                                       | combinações não representáveis (base pagamento, 2 tipos ou várias situações) desabilitam o botão com a explicação                                                  |

## Pontos pendentes de definição institucional

1. Listas de modalidades de contrato e de índices de reajuste: configuráveis em Administração > Regras e listas; o seed traz apenas exemplos genéricos (IPCA, IGP-M, "Locação de imóvel (exemplo)").
2. Regras de pontuação de produtividade (adiadas).
3. Bases legais LGPD, retenção x guarda permanente, aviso de privacidade (`docs/lgpd.md`).
4. SMTP institucional para convites e recuperação de senha em produção.
5. Domínio definitivo (GitHub Pages `github.io` ou domínio próprio da Prefeitura).
6. Estrutura organizacional real (secretarias, diretorias e unidades) a cadastrar após a validação.

## Problemas conhecidos

- Corrigido: fornecedores, regras de aprovação, listas e alertas das Fases 2 e 3 não tinham chegado ao banco remoto (seed não reexecutado). A migration `20261125000800_structural_defaults.sql` os aplica.

- GitHub Pages não permite cabeçalhos HTTP: sem `frame-ancestors`/`X-Frame-Options` (ver `docs/deployment.md`).
- `script-src` requer `'unsafe-inline'` na exportação estática do Next.js.
- Workflow `Supabase migrations` pula com aviso enquanto os projetos remotos não existirem (Fase 7).
- Avisos do React Compiler (não erros) em componentes que usam `useReactTable` e `watch` do React Hook Form.

## Próximas atividades

1. Validação da Fase 6 pela SEMFAZ.
2. Ativar secret scanning e push protection no GitHub (Settings → Code security).
3. Configurar SMTP próprio (ou plano Pro) para os e-mails com código de 6 números.
4. Iniciar a Fase 7 (testes finais, homologação/produção e publicação) após a validação.
