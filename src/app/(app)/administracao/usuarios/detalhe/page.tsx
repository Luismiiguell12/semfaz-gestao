import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { UserDetail } from "./user-detail";

export const metadata: Metadata = { title: "Usuário" };

// Rota estática: o identificador vem por parâmetro de consulta (?id=), pois o
// GitHub Pages não gera páginas para IDs desconhecidos no build.
export default function UserDetailPage() {
  return (
    <RequirePermission permission="users.manage">
      <Suspense fallback={<FullPageLoading />}>
        <UserDetail />
      </Suspense>
    </RequirePermission>
  );
}
