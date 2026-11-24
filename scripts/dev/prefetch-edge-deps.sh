#!/usr/bin/env bash
# SOMENTE para ambientes de desenvolvimento atrás de proxy TLS corporativo,
# em que o container do Edge Runtime local não confia na CA do proxy.
# Pré-carrega as dependências npm das Edge Functions no volume de cache do Deno
# usado pelo `supabase functions serve`. Não é necessário em máquinas comuns
# nem no CI/produção.
# Uso: CA_BUNDLE=/caminho/ca.crt bash scripts/dev/prefetch-edge-deps.sh
set -euo pipefail
CA_BUNDLE="${CA_BUNDLE:?Informe CA_BUNDLE com o certificado da CA do proxy}"
PROJECT_ID="$(grep -oE '"project_id": *"[^"]+"' supabase/config.jsonc | sed -E 's/.*"([^"]+)"$/\1/')"
VOLUME_DIR="$(docker volume inspect "supabase_edge_runtime_${PROJECT_ID}" --format '{{ .Mountpoint }}')"
for fn in supabase/functions/*/; do
  name="$(basename "$fn")"
  [[ "$name" == _* ]] && continue
  echo "Pré-carregando dependências de $name"
  DENO_DIR="$VOLUME_DIR" DENO_CERT="$CA_BUNDLE" npx -y deno@2.1.4 cache --config "$fn/deno.json" "$fn/index.ts"
done
