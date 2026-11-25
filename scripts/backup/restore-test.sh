#!/usr/bin/env bash
# Exercício de restauração (SOMENTE no ambiente local — apaga o banco local).
#  1. impressão digital do banco atual;
#  2. backup (scripts/backup/backup.sh --local);
#  3. simula um projeto novo e vazio: remove os schemas da aplicação, usuários,
#     arquivos e histórico de migrations;
#  4. restaura papéis, estrutura e dados do backup (procedimento oficial do Supabase);
#  5. recria os objetos de plataforma (private.ensure_platform_objects), compara
#     as impressões digitais e roda os testes de segurança no banco restaurado.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=supabase_db_semfaz-gestao
psqlc() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
# Papel administrativo da plataforma (dono das tabelas internas de auth/storage).
psqla() { docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
out="${1:-backups/restore-test-$(date +%Y%m%d-%H%M%S)}"

if [ -f "$out/data.sql" ] && [ -f "$out/fingerprint-antes.txt" ]; then
  echo "1/5 Reutilizando o backup existente em $out (conferindo as somas SHA-256)"
  ( cd "$out" && sha256sum -c --quiet SHA256SUMS )
else
  echo "1/5 Impressão digital antes"
  bash scripts/backup/backup.sh --local "$out" >/dev/null
  cp "$out/fingerprint.txt" "$out/fingerprint-antes.txt"
fi

echo "2/5 Backup gerado em $out ($(du -sh "$out" | cut -f1))"

echo "3/5 Simulando projeto vazio (removendo dados e estrutura da aplicação)"
psqlc -At -c "select count(cron.unschedule(jobid)) from cron.job" >/dev/null
psqla <<'SQL'
set session_replication_role = replica;
drop schema if exists public cascade;
drop schema if exists private cascade;
drop schema if exists tests cascade;
create schema public;
alter schema public owner to pg_database_owner;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
-- Projeto novo: tabelas de auth, storage e hooks vazias (exceto o histórico de migrations delas).
do $$
declare r record;
begin
  for r in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname in ('auth', 'storage', 'supabase_functions') and c.relkind in ('r', 'p')
             and c.relname not in ('schema_migrations', 'migrations')
  loop
    execute format('truncate %I.%I cascade', r.nspname, r.relname);
  end loop;
end $$;
truncate supabase_migrations.schema_migrations, supabase_migrations.seed_files;
SQL
echo "    linhas em public após limpar: $(psqlc -At -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'") tabelas"

echo "4/5 Restaurando papéis, estrutura e dados"
psqlc < "$out/roles.sql" 2> "$out/restore-roles.log" || true
psqlc < "$out/schema.sql"
{ echo "set session_replication_role = replica;"; cat "$out/data.sql"; } | psqlc
psqlc < "$out/history.sql"
echo "    Recriando objetos fora dos schemas da aplicação (passo obrigatório):"
psqlc -At -c "select private.ensure_platform_objects()"

echo "5/5 Conferência"
psqlc < scripts/backup/fingerprint.sql > "$out/fingerprint-depois.txt"
if diff -u "$out/fingerprint-antes.txt" "$out/fingerprint-depois.txt"; then
  echo "    Impressões digitais idênticas: $(wc -l < "$out/fingerprint-depois.txt") itens conferidos"
else
  echo "    DIVERGÊNCIA entre antes e depois" >&2; exit 1
fi
echo "    Migrations registradas: $(psqlc -At -c 'select count(*) from supabase_migrations.schema_migrations')"
echo "    Rotinas agendadas: $(psqlc -At -c "select string_agg(jobname, ', ' order by jobname) from cron.job")"
npx supabase test db supabase/tests/database/01_security_baseline.test.sql supabase/tests/database/05_audit.test.sql \
  supabase/tests/database/15_privileges.test.sql supabase/tests/database/17_integrity.test.sql \
  supabase/tests/database/18_platform_objects.test.sql 2>&1 | grep -E "Result|Tests=|Failed"
