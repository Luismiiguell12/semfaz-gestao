import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { RoleDetail } from "./role-detail";

export const metadata: Metadata = { title: "Perfil de acesso" };

export default function RoleDetailPage() {
  return (
    <RequirePermission permission="roles.manage">
      <Suspense fallback={<FullPageLoading />}>
        <RoleDetail />
      </Suspense>
    </RequirePermission>
  );
}
