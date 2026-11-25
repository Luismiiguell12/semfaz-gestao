# Status do projeto — SEMFAZ Gestão

> Leia este arquivo no início de cada sessão de trabalho.

## Fase atual

**Alteração 01 aplicada, aguardando validação** (ver `docs/change-requests.md`). Fases 2 e 3 concluídas e aguardando a validação conjunta (a Fase 3 foi iniciada antes da validação da Fase 2, a pedido do responsável). A Alteração 01 chegou durante essa validação e foi aplicada como etapa própria. Próxima atividade do planejamento original, após a validação: **Fase 4 (demandas e calendário)**.

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

- Nada. Aguardando a validação das Fases 2 e 3 e da Alteração 01.

## Pendentes (próximas fases)

- Fase 4: demandas e calendário.
- Fase 5: produtividade (sem pontuação).
- Fase 6: relatórios e exportações, incluindo a **exportação Excel/PDF dos Relatórios de despesas** (Alteração 01, item B). Os "Relatórios financeiros" do Módulo 4 foram substituídos pela tela Relatórios de despesas, já entregue.
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

1. Validação conjunta das Fases 2 e 3 e da Alteração 01 pela SEMFAZ.
2. Ativar secret scanning e push protection no GitHub (Settings → Code security).
3. Configurar SMTP próprio (ou plano Pro) para os e-mails com código de 6 números.
4. Iniciar a Fase 4 (demandas e calendário) após a validação.
