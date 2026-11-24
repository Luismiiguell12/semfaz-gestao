# SEMFAZ Gestão

Plataforma de gestão administrativa da **Secretaria Municipal da Fazenda** da
**Prefeitura Municipal de Lagarto/SE**: imóveis e locações, contratos,
unidades consumidoras, faturas, demandas, aprovações e auditoria.

> Projeto em desenvolvimento por fases. Status atual: [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).
> Nenhum dado oficial real deve ser carregado antes da validação institucional.

## Stack

Next.js (exportação estática, GitHub Pages) · React · TypeScript · Tailwind CSS ·
shadcn/ui · TanStack Query · Supabase (PostgreSQL, Auth, Storage, Edge Functions).
Toda regra de negócio e autorização fica no banco (RLS, triggers e funções).

## Documentação

- [Arquitetura](docs/architecture.md)
- [Banco de dados](docs/database.md)
- [Permissões](docs/permissions.md)
- [Regras de negócio](docs/business-rules.md)
- [LGPD](docs/lgpd.md)
- [Implantação e ambientes](docs/deployment.md)
- [Changelog](docs/CHANGELOG.md)

## Início rápido (desenvolvimento)

```bash
npm ci
npx supabase start
npx supabase db reset
npm run dev
```

Detalhes, testes e configuração de homologação/produção em [`docs/deployment.md`](docs/deployment.md).

## Segurança

Repositório público: nunca faça commit de `.env`, chaves, senhas ou dados reais.
A service role key só é usada em scripts locais, nos secrets do GitHub Actions
e dentro das Edge Functions.
