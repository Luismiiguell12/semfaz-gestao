# Status do projeto — SEMFAZ Gestão

> Leia este arquivo no início de cada sessão de trabalho.

## Fase atual

**Fase 1 — Fundação: concluída, aguardando validação.** A Fase 2 só começa após a aprovação.

## Funcionalidades concluídas (Fase 1)

- **1A Base técnica:** Next.js 16 + TypeScript estrito + Tailwind 4 + componentes shadcn/ui; exportação estática com `basePath`; ESLint e Prettier; Vitest, pgTAP e Playwright; workflows de CI, Pages e migrations; `.env.example`; documentação.
- **1B Banco e segurança:** 9 migrations; funções de autorização; RLS em 100% das tabelas; auditoria por triggers; infraestrutura de documentos (bucket privado, metadados, versionamento, políticas); infraestrutura de notificações; seed estrutural.
- **1C Autenticação e administração:** login, logout, recuperação e definição de senha; convite por Edge Function; MFA TOTP obrigatório para administradores; script do primeiro administrador; departamentos; usuários (perfis, escopos, situação); perfis de acesso e permissões; consulta à auditoria.
- **1D Layout e identidade:** shell com sidebar recolhível e gaveta no celular, cabeçalho, breadcrumbs, menu do usuário e notificações; componentes reutilizáveis; painel inicial com indicadores disponíveis e estado vazio.

## Em andamento

- Nada. Aguardando validação da Fase 1.

## Pendentes (próximas fases)

- Fase 2: motor de aprovações, central de aprovações, imóveis, locadores, contratos, aditivos, histórico, alertas (`pg_cron`), `user_property_access`.
- Fase 3: fornecedores, unidades consumidoras, faturas, aluguéis, pagamentos, análise de consumo.
- Fase 4: demandas e calendário.
- Fase 5: produtividade (sem pontuação).
- Fase 6: relatórios e exportações.
- Fase 7: testes finais, projetos de homologação/produção e publicação.

## Decisões técnicas

| #   | Decisão                                                                                                | Motivo                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TypeScript 6.0.3 em vez do 7.x                                                                         | o 7.x (compilador nativo) é recente e com compatibilidade incerta com o ecossistema do Next/ESLint                              |
| 2   | Componentes shadcn/ui escritos no padrão oficial sobre `radix-ui`                                      | o host `ui.shadcn.com` estava bloqueado no ambiente de desenvolvimento; o resultado é o mesmo (código-fonte no projeto)         |
| 3   | Funções de autorização no schema `private`                                                             | não ficam expostas como RPC; políticas e RPCs as usam                                                                           |
| 4   | Perfil `admin` com todas as permissões de forma implícita e não editável                               | evita perda acidental de acesso administrativo e cobre permissões de módulos futuros                                            |
| 5   | Permissões privilegiadas (`is_privileged`) exigem AAL2                                                 | implementa "MFA obrigatório para administradores" no backend, não só na interface                                               |
| 6   | Bloqueio duplo de usuário inativo: RLS + banimento no Supabase Auth                                    | RLS nega dados imediatamente; o banimento impede novo login e renovação de sessão                                               |
| 7   | Envio de documentos só pela Edge Function, com service role após autorização                           | a verificação do tipo real exige ler o arquivo no servidor; o upload direto pelo navegador permitiria burlar a validação        |
| 8   | Departamentos podem receber documentos                                                                 | tipo de registro disponível na Fase 1 para validar a infraestrutura genérica; imóveis, contratos etc. entram nas próximas fases |
| 9   | Schemas Zod em `supabase/functions/_shared/schemas` importados pelo frontend (`@shared/*`)             | fonte única de validação para cliente e Edge Functions                                                                          |
| 10  | Fluxo de autenticação `implicit` no `supabase-js`                                                      | compatível com convites gerados pelo administrador (sem `code_verifier` no navegador)                                           |
| 11  | `permissions` e `notification_types` sem `organization_id`                                             | catálogos globais mantidos por migration, não são dados de negócio                                                              |
| 12  | Tabelas de vínculo (`user_roles`, `role_permissions`, `user_department_access`) aceitam remoção física | são configuração de acesso, não registros de negócio; toda remoção é auditada com os dados anteriores                           |
| 13  | Seed estrutural idempotente aplicado também nos ambientes remotos (`db push --include-seed`)           | perfis e permissões são necessários em produção                                                                                 |
| 14  | Formatação de datas com `Intl` (America/Maceio); date-fns adiado para a Fase 4                         | a fundação não precisa de cálculos de data; evita dependência ociosa                                                            |
| 15  | Fila `notification_email_queue` sem envio                                                              | arquitetura de e-mail preparada, conforme o escopo                                                                              |
| 16  | Fonte Public Sans auto-hospedada                                                                       | identidade institucional sem CDN externo (compatível com a CSP)                                                                 |
| 17  | Indicadores do painel em função SQL (`dashboard_foundation_stats`)                                     | cálculo no banco respeitando permissões                                                                                         |

## Pontos pendentes de definição institucional

1. Listas de modalidades de contrato e de índices de reajuste (Fase 2): serão configuráveis, sem valores oficiais.
2. Regras de pontuação de produtividade (adiadas).
3. Bases legais LGPD, retenção x guarda permanente, aviso de privacidade (`docs/lgpd.md`).
4. SMTP institucional para convites e recuperação de senha em produção.
5. Domínio definitivo (GitHub Pages `github.io` ou domínio próprio da Prefeitura).
6. Estrutura organizacional real (secretarias, diretorias e unidades) a cadastrar após a validação.

## Problemas conhecidos

- GitHub Pages não permite cabeçalhos HTTP: sem `frame-ancestors`/`X-Frame-Options` (ver `docs/deployment.md`).
- `script-src` requer `'unsafe-inline'` na exportação estática do Next.js.
- Workflow `Supabase migrations` pula com aviso enquanto os projetos remotos não existirem (Fase 7).
- Avisos do React Compiler (não erros) em componentes que usam `useReactTable` e `watch` do React Hook Form.

## Próximas atividades

1. Validação da Fase 1 pela SEMFAZ.
2. Ativar secret scanning e push protection no GitHub (Settings → Code security).
3. Iniciar a Fase 2 pelo motor genérico de aprovações.
