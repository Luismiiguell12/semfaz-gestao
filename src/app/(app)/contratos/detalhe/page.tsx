import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { ContractDetail } from "./contract-detail";

export const metadata: Metadata = { title: "Contrato" };

export default function ContractDetailPage() {
  return (
    <RequirePermission permission="contracts.view">
      <Suspense fallback={<FullPageLoading />}>
        <ContractDetail />
      </Suspense>
    </RequirePermission>
  );
}
