# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

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
