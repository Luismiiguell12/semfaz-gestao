import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { InvoiceDetail } from "./invoice-detail";

export const metadata: Metadata = { title: "Fatura" };

export default function InvoiceDetailPage() {
  return (
    <RequirePermission permission="invoices.view">
      <Suspense fallback={<FullPageLoading />}>
        <InvoiceDetail />
      </Suspense>
    </RequirePermission>
  );
}
