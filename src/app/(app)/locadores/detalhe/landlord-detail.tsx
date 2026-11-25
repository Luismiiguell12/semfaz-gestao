"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { EmptyState, ErrorState, FullPageLoading } from "@/components/shared/states";
import { DetailList } from "@/components/shared/detail-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLandlord } from "@/modules/landlords/api";
import { LandlordDialog } from "@/modules/landlords/landlord-dialog";
import { useAuth } from "@/providers/auth-provider";
import { formatCalendarDate } from "@/lib/format";

const share = (v: number | null) => (v === null ? "Locador único" : `${String(v).replace(".", ",")}%`);

export function LandlordDetail() {
  const id = useSearchParams().get("id");
  const q = useLandlord(id);
  const { can } = useAuth();
  const [editing, setEditing] = React.useState(false);
  if (q.isLoading) return <FullPageLoading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const l = q.data?.landlord;
  if (!l)
    return (
      <EmptyState
        title="Locador não encontrado"
        description="O registro não existe ou está fora do seu acesso."
      />
    );
  const current = q.data!.properties.filter((p) => !p.deleted_at);
  const past = q.data!.properties.filter((p) => p.deleted_at);
  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3">
        <Link href="/locadores/">
          <ArrowLeft aria-hidden="true" /> Locadores
        </Link>
      </Button>
      <PageHeader
        title={l.name}
        description={l.person_type === "individual" ? "Pessoa física" : "Pessoa jurídica"}
        actions={
          can("landlords.manage") && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" /> Editar
            </Button>
          )
        }
      />
      <div className="space-y-6">
        <Panel title="Dados do locador" description="Dados bancários não são armazenados.">
          <DetailList
            items={[
              {
                label: l.person_type === "individual" ? "CPF" : "CNPJ",
                value: <span className="tabular">{l.document_masked}</span>,
              },
              { label: "Telefone", value: l.phone_masked ?? "—" },
              { label: "E-mail", value: l.email ?? "—" },
              { label: "Endereço", value: l.address ?? "—" },
              { label: "Observações", value: l.notes ?? "—" },
            ]}
          />
        </Panel>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Panel title="Imóveis" description="Vínculos atuais e anteriores no seu escopo.">
            {current.length + past.length === 0 ? (
              <EmptyState title="Nenhum imóvel vinculado no seu escopo" className="py-6" />
            ) : (
              <ul className="divide-y rounded-md border">
                {[...current, ...past].map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    {p.properties ? (
                      <Link
                        href={`/imoveis/detalhe/?id=${p.property_id}`}
                        className="text-primary font-semibold hover:underline"
                      >
                        {p.properties.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Imóvel de acesso restrito</span>
                    )}
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{share(p.share_percent)}</span>
                      {p.deleted_at ? (
                        <Badge tone="neutral">Anterior</Badge>
                      ) : (
                        <Badge tone="success">Atual</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Contratos">
            {q.data!.contracts.length === 0 ? (
              <EmptyState title="Nenhum contrato no seu escopo" className="py-6" />
            ) : (
              <ul className="divide-y rounded-md border">
                {q.data!.contracts.map((c) => (
                  <li key={c.id} className="px-4 py-3 text-sm">
                    {c.contracts ? (
                      <>
                        <Link
                          href={`/contratos/detalhe/?id=${c.contract_id}`}
                          className="text-primary font-semibold hover:underline"
                        >
                          Contrato {c.contracts.contract_number}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {c.contracts.properties?.name ?? "Imóvel de acesso restrito"} ·{" "}
                          {formatCalendarDate(c.contracts.start_date)} a{" "}
                          {formatCalendarDate(c.contracts.end_date)} · {share(c.share_percent)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Contrato de acesso restrito</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
      {editing && <LandlordDialog editing={l} open onOpenChange={(v) => !v && setEditing(false)} />}
    </>
  );
}
