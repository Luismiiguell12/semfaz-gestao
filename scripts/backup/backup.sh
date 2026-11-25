#!/usr/bin/env bash
# Backup lógico do banco (papéis, estrutura e dados) com a CLI do Supabase.
#
# Uso:
#   Local:         bash scripts/backup/backup.sh --local [pasta]
#   Homologação/produção (a senha nunca vai para o repositório):
#     export SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@<host>:5432/postgres'
#     bash scripts/backup/backup.sh --remote [pasta]
#
# Gera <pasta>/roles.sql, schema.sql, data.sql, history.sql (migrations aplicadas)
# e fingerprint.txt (conferência), com SHA256SUMS.
# Os arquivos contêm dados pessoais: guarde-os em local institucional protegido,
# nunca no repositório (a pasta backups/ está no .gitignore).
# Arquivos do Storage (documentos) não fazem parte deste backup: ver
# docs/deployment.md, seção "Backups".
set -euo pipefail
mode="${1:-}"
out="${2:-backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$out"
case "$mode" in
  --local) target=() ;;
  --remote)
    : "${SUPABASE_DB_URL:?Defina SUPABASE_DB_URL (não grave a senha em arquivos do projeto).}"
    target=(--db-url "$SUPABASE_DB_URL") ;;
  *) echo "Uso: $0 --local|--remote [pasta]" >&2; exit 2 ;;
esac
npx supabase db dump "${target[@]}" --role-only -f "$out/roles.sql"
npx supabase db dump "${target[@]}" -f "$out/schema.sql"
# Tabelas internas do Storage de recursos não usados pelo sistema (vetores, analytics,
# iceberg, ciclo de vida): ficam vazias e pertencem ao papel administrativo da
# plataforma, que o papel postgres não pode gravar na restauração.
npx supabase db dump "${target[@]}" --data-only --use-copy \
  -x storage.buckets_vectors -x storage.buckets_analytics -x storage.vector_indexes \
  -x storage.iceberg_namespaces -x storage.iceberg_tables \
  -x storage.bucket_lifecycle_states -x storage.lifecycle_abandoned_artifacts \
  -f "$out/data.sql"
# Histórico de migrations (sem ele, a próxima implantação tentaria refazer todas).
npx supabase db dump "${target[@]}" --data-only --use-copy -s supabase_migrations -f "$out/history.sql"
if [ "$mode" = --local ]; then
  docker exec -i supabase_db_semfaz-gestao psql -U postgres -q < scripts/backup/fingerprint.sql > "$out/fingerprint.txt"
else
  psql "$SUPABASE_DB_URL" -q -f scripts/backup/fingerprint.sql > "$out/fingerprint.txt"
fi
( cd "$out" && sha256sum roles.sql schema.sql data.sql history.sql fingerprint.txt > SHA256SUMS )
echo "Backup concluído em $out"
