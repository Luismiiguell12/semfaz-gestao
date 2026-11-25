import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { NewContractForm } from "./new-contract-form";

export const metadata: Metadata = { title: "Solicitar contrato" };

export default function NewContractPage() {
  return (
    <RequirePermission permission="contracts.manage">
      <Suspense fallback={<FullPageLoading />}>
        <NewContractForm />
      </Suspense>
    </RequirePermission>
  );
}
