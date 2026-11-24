# Implantação

## Ambientes

| Ambiente        | Banco/Auth                                                 | Frontend                                | Como é atualizado                                                                           |
| --------------- | ---------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Desenvolvimento | Supabase local (`supabase start`)                          | `npm run dev`                           | manual                                                                                      |
| Homologação     | projeto Supabase dedicado                                  | build com `NEXT_PUBLIC_APP_ENV=staging` | workflow `Supabase migrations` (automático na `main` para `staging`)                        |
| Produção        | projeto Supabase **Pro**, região **São Paulo (sa-east-1)** | GitHub Pages                            | migrations: workflow manual com aprovação; frontend: `Deploy GitHub Pages` após CI aprovada |

## Desenvolvimento local

Pré-requisitos: Node.js 22, Docker.

```bash
npm ci
npx supabase start -x studio,imgproxy,vector,logflare,supavisor,postgres-meta
npx supabase db reset
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env
```

Crie `.env.local` a partir de `.env.example` com a URL e a chave **anon** exibidas por `npx supabase status`.

```bash
npm run dev
```

O sistema abre em `http://localhost:3000/semfaz-gestao`. E-mails locais (convites, recuperação) aparecem no Mailpit: `http://127.0.0.1:54324`.

Primeiro administrador local:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY local> APP_URL=http://localhost:3000/semfaz-gestao npm run create-admin
```

Atrás de proxy TLS corporativo, o Edge Runtime local pode não confiar na CA do proxy. Nesse caso, rode `CA_BUNDLE=<ca.crt> bash scripts/dev/prefetch-edge-deps.sh` depois do `supabase start`.

## Testes

```bash
npm run lint && npm run typecheck && npm test
npm run test:db
npm run test:integration
npm run build && npm run test:e2e
```

`test:integration` e `test:e2e` exigem o Supabase local e as Edge Functions em execução.

## Configuração dos projetos remotos (Fase 7)

1. Criar dois projetos Supabase (homologação e produção), região São Paulo, plano Pro.
2. Em **Authentication**:
   - desativar _Allow new users to sign up_;
   - _Site URL_ = `https://<usuario>.github.io/semfaz-gestao`;
   - _Redirect URLs_ = somente `https://<usuario>.github.io/semfaz-gestao/**` (e o domínio de homologação);
   - política de senha: mínimo 10, com maiúsculas, minúsculas e números; _Secure password change_ ativo;
   - MFA TOTP habilitado;
   - modelos de e-mail de convite e recuperação: copiar de `supabase/templates/`;
   - SMTP próprio da Prefeitura (o SMTP padrão do Supabase tem limite baixo).
3. GitHub → _Settings → Environments_:
   - `staging` e `production` com os **secrets** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` e as **variables** `ALLOWED_ORIGINS` (ex.: `https://<usuario>.github.io`) e `APP_URL`;
   - `production` com _Required reviewers_;
   - `github-pages` com as **variables** públicas `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e opcionalmente `NEXT_PUBLIC_APP_ENV`).
4. GitHub → _Settings → Pages_: origem **GitHub Actions**.
5. GitHub → _Settings → Code security_: ativar **secret scanning** e **push protection**.
6. Executar `Supabase migrations` para `staging`, validar, e depois para `production`.
7. Criar o primeiro administrador com `scripts/create-admin.mjs` (executado localmente por pessoa autorizada; a service role key é digitada no terminal e nunca gravada).

## Limitações do GitHub Pages

O GitHub Pages **não permite cabeçalhos HTTP personalizados**. Consequências:

| Controle                                                  | Situação                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content-Security-Policy                                   | aplicada por `<meta http-equiv>` em todas as páginas                                                                                                     |
| `frame-ancestors` / `X-Frame-Options` (anti-clickjacking) | **não disponíveis** por meta; o site pode ser exibido em iframe de terceiros. Mitigação: operações sensíveis exigem confirmação em modal e justificativa |
| HSTS personalizado                                        | não configurável; o GitHub Pages força HTTPS no domínio `github.io` (que está na lista de pré-carregamento HSTS)                                         |
| `report-uri` / `report-to`                                | não suportados por meta                                                                                                                                  |
| `script-src`                                              | requer `'unsafe-inline'`, pois a exportação estática do Next.js injeta scripts inline de hidratação sem nonce                                            |
| Referrer-Policy                                           | aplicada por meta (`strict-origin-when-cross-origin`)                                                                                                    |

A migração para uma hospedagem com servidor (Vercel ou infraestrutura da
Prefeitura) permite cabeçalhos completos sem alterar o backend.

## Backups

- Plano Pro: backup diário automático (retenção conforme o plano) e, se contratado, **PITR** (recuperação em ponto no tempo).
- Arquivos do Storage não entram no backup do banco: avaliar exportação periódica do bucket `documents`.
- **Teste de restauração** (Fase 7): restaurar um backup no projeto de homologação, conferir contagens das tabelas e a integridade da auditoria, e registrar o resultado aqui.
