# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

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
