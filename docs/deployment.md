# Implantação

## Ambientes

| Ambiente        | Banco/Auth                                                                                | Site                                                     | Como é atualizado                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Desenvolvimento | Supabase local (`supabase start`)                                                         | `npm run dev`                                            | manual                                                                                                                            |
| Homologação     | projeto Supabase de homologação (ambiente GitHub `staging`)                               | `https://<usuario>.github.io/semfaz-gestao/homologacao/` | automático: cada commit na `main` (banco: workflow `Supabase migrations`; site: `Deploy GitHub Pages`)                            |
| Produção        | projeto Supabase **Pro**, região **São Paulo (sa-east-1)** (ambiente GitHub `production`) | `https://<usuario>.github.io/semfaz-gestao/`             | por **versão** `vX.Y.Z`: workflow `Release produção` com **aprovação manual**; o site de produção só muda depois do banco migrado |

Enquanto a variável `PROD_SUPABASE_URL` não existir, o site funciona em **modo único**: `/semfaz-gestao/`
mostra a `main` com o banco de homologação (situação atual).

### Fluxo de uma mudança até a produção

1. Commit na `main` → CI (todos os testes) → homologação atualizada (banco e site `/homologacao/`).
2. A SEMFAZ valida em homologação.
3. Criar a versão: GitHub → _Releases_ → _Draft a new release_ → tag `v1.0.0` (formato `vX.Y.Z`) no commit validado.
4. O workflow **Release produção** confere a versão (formato e commit da `main`) e aguarda a **aprovação** de um revisor do ambiente `production`.
5. Aprovado: migrations, configuração de autenticação e Edge Functions aplicadas no projeto de produção.
6. Em seguida, `Deploy GitHub Pages` publica o site de produção **a partir dessa versão** (a homologação continua na `main`).

Se o passo 5 falhar ou não for aprovado, o site de produção continua na versão anterior (o banco e o site nunca ficam descompassados).

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

## Implantação de homologação e produção (passo a passo)

Quem executa: responsável técnico da SEMFAZ com acesso de administrador ao GitHub e ao Supabase.
Nenhum segredo é enviado ao assistente, ao repositório ou ao chat: tokens e senhas são colados
**somente** nas telas do Supabase e do GitHub.

**A. Projetos Supabase** (supabase.com → _New project_):

1. Organização no plano **Pro** (valores atuais em supabase.com/pricing; cada projeto tem custo de computação próprio).
2. Criar `semfaz-producao`, região **South America (São Paulo)**, senha forte do banco guardada no cofre institucional.
3. Homologação: manter o projeto atual (`snqtaihwsbforgeqiifk`) ou criar `semfaz-homologacao` na mesma organização Pro.
4. Em cada projeto, **Authentication → SMTP**: SMTP institucional da Prefeitura (o padrão do Supabase tem limite baixo e não permite os modelos com código de 6 números).
5. Em produção, **Database → Backups**: confirmar o backup diário; avaliar **PITR** (recuperação em ponto no tempo).

**B. GitHub → Settings → Environments:**

| Ambiente       | Secrets                                                                 | Variables                                                                                                                                                | Proteção                                            |
| -------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `staging`      | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | `APP_URL` = `https://<usuario>.github.io/semfaz-gestao/homologacao`, `ALLOWED_ORIGINS` = `https://<usuario>.github.io`                                   | —                                                   |
| `production`   | os mesmos três, **do projeto de produção**                              | `APP_URL` = `https://<usuario>.github.io/semfaz-gestao`, `ALLOWED_ORIGINS` = `https://<usuario>.github.io`                                               | **Required reviewers**; _Deployment tags_: `v*.*.*` |
| `github-pages` | —                                                                       | `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (homologação); `PROD_SUPABASE_URL` e `PROD_SUPABASE_ANON_KEY` (produção, chave **pública**) | —                                                   |

Ao mudar o endereço da homologação para `/homologacao`, atualizar o `APP_URL` do ambiente `staging`
e reexecutar `Supabase migrations` (staging) para ajustar o _Site URL_ e as _Redirect URLs_.

**C. Primeira versão em produção:**

1. GitHub → _Actions_ → `Release produção` não aparece até existir a primeira tag: criar a release `v1.0.0` na `main`.
2. Aprovar o job "Banco de produção" quando solicitado.
3. Conferir o site `…/semfaz-gestao/` (produção) e `…/semfaz-gestao/homologacao/`.
4. Criar o primeiro administrador de produção com `scripts/create-admin.mjs` (executado localmente; a service role key é digitada no terminal e nunca gravada). Ativar o MFA no primeiro acesso.
5. Cadastrar a estrutura organizacional real e os usuários (convites).

**D. Segurança do repositório:** _Settings → Code security_: **secret scanning** e **push protection**.

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

## Backups e restauração

### O que o Supabase Pro faz

- Backup diário automático do banco (retenção conforme o plano) e, se contratado, **PITR**.
- Restauração pelo painel (_Database → Backups_), no mesmo projeto ou em um projeto novo.

### Backup lógico próprio (recomendado mensalmente e antes de cada versão)

```bash
export SUPABASE_DB_URL='postgresql://...'   # cadeia de conexão do painel; nunca gravar em arquivo do projeto
bash scripts/backup/backup.sh --remote backups/producao-AAAAMMDD
```

Gera `roles.sql`, `schema.sql`, `data.sql`, `history.sql` (migrations aplicadas), `fingerprint.txt`
(contagens, totais e hash da auditoria) e `SHA256SUMS`. **Contém dados pessoais**: guardar em local
institucional protegido; a pasta `backups/` é ignorada pelo Git.

Os **arquivos** do bucket `documents` não fazem parte do backup do banco: exportá-los periodicamente
(painel do Storage ou CLI) para o mesmo local protegido.

### Restauração em um projeto novo

```bash
psql "$DESTINO" -v ON_ERROR_STOP=1 -f roles.sql
psql "$DESTINO" -v ON_ERROR_STOP=1 -f schema.sql
psql "$DESTINO" -v ON_ERROR_STOP=1 -c "set session_replication_role = replica" -f data.sql
psql "$DESTINO" -v ON_ERROR_STOP=1 -f history.sql
psql "$DESTINO" -v ON_ERROR_STOP=1 -c "select private.ensure_platform_objects()"   # OBRIGATÓRIO
psql "$DESTINO" -q -f scripts/backup/fingerprint.sql   # comparar com fingerprint.txt do backup
```

O último passo recria o que fica **fora** dos schemas da aplicação e não vem no backup de estrutura:
auditoria de login (`auth.sessions`), política de leitura de arquivos (`storage.objects`), bucket privado
e as 4 rotinas agendadas. Sem ele, o sistema volta a funcionar sem auditar logins, sem abrir anexos e
sem as rotinas diárias.

### Exercício de restauração (testado na Fase 7)

`bash scripts/backup/restore-test.sh` (somente local; apaga o banco local): impressão digital → backup →
simulação de projeto vazio → restauração → `ensure_platform_objects` → comparação das impressões digitais
→ testes de segurança no banco restaurado. Resultado registrado em `docs/PROJECT_STATUS.md`.
Repetir o exercício em homologação, com um backup real de produção, antes da entrada em produção e
uma vez por semestre.
