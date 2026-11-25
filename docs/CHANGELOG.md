# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado] — Fase 7: Testes finais e implantação

### Segurança

- Corrigido: usuário comum podia alterar o perfil de colegas escrevendo na visão `user_directory` pela API. Visões passaram a ser somente leitura; usuários sem DELETE/TRUNCATE; escrita direta só em 9 tabelas de configuração.

### Adicionado

- Teste de ataque direto à API em todas as tabelas e visões; matriz de privilégios; integridade estrutural; geração de aluguéis com aditivos; objetos de plataforma.
- Varredura de todas as telas nos três tamanhos com verificação de acessibilidade (axe-core).
- Backup lógico (`scripts/backup/backup.sh`) e exercício de restauração (`restore-test.sh`); `private.ensure_platform_objects()`.
- Workflow `Release produção` (versões `vX.Y.Z` com aprovação) e site com homologação em `/homologacao/`.

### Alterado

- Relatório de despesas e painel financeiro muito mais rápidos (escopo calculado uma vez por consulta).
- Acessibilidade: filtros como grupo de botões, tabelas largas roláveis pelo teclado, rótulos coerentes com o texto visível, contraste no calendário.
- 351 testes pgTAP, 36 de integração, 34 unitários e 80 E2E.

## [Não publicado] — Fase 6: Relatórios e exportações

### Adicionado

- Página Relatórios com 13 relatórios (Gestão, Financeiro e Acompanhamento), filtros e prévia.
- Exportação para Excel e PDF pela Edge Function `reports-export`, com o token do usuário e registro na auditoria (`EXPORT`) antes da entrega.
- Exportação nas telas Relatórios de despesas e Produtividade.
- 9 testes pgTAP (310 no total), 6 testes de integração da exportação e 3 E2E (9 execuções nos três tamanhos de tela).

### Alterado

- Menu: Relatórios habilitado. Breadcrumbs aceitam rótulo pelo caminho completo.

## [Não publicado] — Fase 5: Produtividade (sem pontuação)

### Adicionado

- Indicadores individuais e coletivos (recebidas, concluídas, pendentes, atrasadas, percentual de conclusão, cumprimento de prazos, tempo médio, complexidade e participação) por mês, trimestre, semestre e ano.
- Página Produtividade com gráficos e tabela da equipe (ordem alfabética, sem ranking) e aviso de uso.
- Consolidação mensal automática (`productivity_snapshots`) e catálogo `task_complexity_levels`.
- Painel: "Minha produtividade no mês" e "Produtividade por colaborador" (com `productivity.view_team`).
- 26 testes pgTAP (301 no total) e 2 E2E (6 execuções nos três tamanhos de tela).

## [Não publicado] — Fase 4: Demandas e calendário

### Adicionado

- Demandas com participantes, categorias (7 iniciais e criação por quem tem permissão), urgência, prioridade, complexidade, status com histórico, registro de conclusão, atraso calculado, comentários, anexos e histórico.
- Visões lista e kanban (arrastar com mouse, toque e teclado) e detalhe da demanda.
- Calendário mensal, semanal e diário com prazos de demandas, reuniões, compromissos, prazos e lembretes.
- Exclusão de demanda somente por aprovação (criador ou exclusão excepcional por administrador), sempre lógica.
- Notificações de demandas e rotina diária de prazo próximo e atraso.
- Painel: demandas abertas, em andamento, concluídas, atrasadas, por status e próximos compromissos.
- 48 testes pgTAP (275 no total) e 3 E2E (9 execuções nos três tamanhos de tela).

### Alterado

- Aprovações: operações com aprovação obrigatória não podem ser dispensadas nas Regras.
- Menu: Demandas e Calendário habilitados.
- Correção de rolagem horizontal no celular em contêineres com rolagem interna.

## [Não publicado] — Alteração 01: cadastro integrado, menus e Relatórios de despesas

### Adicionado

- Novo cadastro a partir de contrato (assistente em 5 etapas, rascunho no banco, pacote único de aprovação com efetivação tudo ou nada; avisos de CPF/CNPJ, imóvel e unidade já cadastrados; transferência de unidade com histórico).
- Ficha do locador; aba Aditivos e separação atual/anterior em contratos e unidades na ficha do imóvel.
- Financeiro > Pagamentos e Financeiro > Relatórios de despesas (com página de lançamentos para detalhamento).
- Sugestão de valor global (mensal × vigência) nos formulários de contrato; preenchimento automático de imóvel, fornecedor, secretaria e unidade de medida no lançamento de fatura.
- Permissões `consumer_units.view`, `consumer_units.manage` e `finance.reports.view`.
- 39 testes pgTAP do assistente e das permissões, 18 dos relatórios (227 no total), 6 unitários da sugestão de valor global e 12 E2E (menus, assistente completo, renovação com duplicidades e transferência, relatórios).

### Alterado

- Menu reorganizado: Gestão (cadastro guiado, contratos, locadores, imóveis, unidades consumidoras), Financeiro (faturas, aluguéis, pagamentos, relatórios de despesas) e Acompanhamento; itens futuros com selo "Em breve".
- Unidades consumidoras saem do Financeiro (módulo `consumer-units`), com permissões próprias concedidas aos mesmos perfis.
- Painel financeiro calculado pela mesma base dos relatórios.
- Comparação "atual × proposto" das aprovações exibe os campos em ordem lógica.

### Desempenho

- Custo declarado nas funções de autorização usadas pela RLS: visões financeiras 10 a 16 vezes mais rápidas.

## [Não publicado] — Fase 3: Financeiro

### Adicionado

- Fornecedores (Energisa e Iguá) e unidades consumidoras com histórico de vínculos a imóveis; a unidade é cadastrada já vinculada a um imóvel.
- Faturas de água e energia com imóvel derivado do vínculo na competência, bloqueio de duplicidade (só com justificativa e aprovação), correção e cancelamento via aprovação.
- Aluguéis gerados automaticamente a partir dos contratos, com proporcionalidade e memória de cálculo.
- Pagamentos parciais e estornos imutáveis via aprovação; situação calculada no banco.
- Análise de consumo (média dos 3 meses anteriores, alerta acima de 30%) e alertas de fatura vencida em rotina diária.
- Cadastro de fornecedores em Administração > Regras e listas.
- Telas de Unidades consumidoras, Faturas e Aluguéis; indicadores e gráficos financeiros no painel.

### Corrigido

- Dados estruturais das Fases 2 e 3 (fornecedores, regras de aprovação e de alerta, listas e configurações) ausentes no banco remoto: aplicados por migration idempotente.

### Testes

- 35 novos testes pgTAP (170 no total) e E2E do fluxo de fatura e pagamento parcial em desktop, tablet e celular.

## [Não publicado] — Fase 2: Aprovações, imóveis e contratos

### Adicionado

- Motor genérico de aprovações e Central de Aprovações (aprovar, rejeitar com motivo, cancelar; comparação atual × proposto; bloqueio de autoaprovação e de efetivação sobre registro alterado).
- Imóveis (com escopo por secretaria e por imóvel selecionado), locadores (CPF/CNPJ validados e mascarados) e vínculo imóvel–locador com percentuais.
- Contratos e aditivos com vigência e valor vigentes calculados; listas configuráveis de modalidade e índice de reajuste.
- Alertas diários de vencimento e data-base (`pg_cron`) e indicadores de imóveis, contratos e aprovações no painel.
- Tela de Regras e listas (operações que exigem aprovação, prazos de alerta, listas).
- 58 novos testes pgTAP (135 no total), 5 unitários e 6 E2E.

### Alterado

- Primeiro acesso e recuperação de senha passam a usar **código de 6 números** enviado por e-mail, em vez de link de uso único (que podia ser "gasto" pela pré-visualização de aplicativos de e-mail). Novas telas: Primeiro acesso e Recuperar senha com etapa de código.
- Workflow de migrations aplica também a configuração de autenticação do projeto remoto (endereços, cadastro público desativado, política de senha, MFA e modelos de e-mail).
- Workflow manual para criar o primeiro administrador e reenviar convite/código, sem expor dados pessoais nos registros públicos.

## Fase 1: Fundação

### Adicionado

- Projeto Next.js 16 com exportação estática para o GitHub Pages (`basePath`, `trailingSlash`, `404.html`).
- Supabase local com cadastro público desativado, política de senha forte e MFA TOTP.
- Banco: organizações, departamentos hierárquicos, perfis de usuário, perfis de acesso, permissões, escopos por departamento, configurações, notificações, documentos e auditoria.
- Funções de autorização (`has_permission`, `department_in_scope`, `is_active_user`, MFA/AAL2) e RLS em todas as tabelas.
- Auditoria imutável por triggers, incluindo login, logout e verificação de MFA.
- RPCs administrativas com proteção contra autoalteração de acesso, remoção do último administrador e escalonamento de privilégios.
- Edge Functions `admin-users` (convite, situação, reenvio) e `documents-upload` (tipo real, SHA-256, versionamento).
- Interface: login, recuperação e definição de senha, MFA, painel, notificações, minha conta, departamentos (com documentos), usuários, perfis de acesso e auditoria.
- Identidade visual própria (marca "linhas de livro-razão", Public Sans, tokens de cor) e layout responsivo.
- Seed estrutural idempotente, script do primeiro administrador e modelos de e-mail em português.
- Testes: 77 pgTAP, 23 de integração, 23 unitários e 24 E2E (desktop, tablet e celular).
- Workflows de CI, deploy no GitHub Pages e migrations por ambiente.
