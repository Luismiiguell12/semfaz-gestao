import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Novo cadastro a partir de contrato" };

export default function WizardPage() {
  return (
    <RequirePermission permission="contracts.manage">
      <Suspense fallback={<FullPageLoading />}>
        <Wizard />
      </Suspense>
    </RequirePermission>
  );
}
