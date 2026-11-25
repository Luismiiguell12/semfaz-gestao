import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { RentDetail } from "./rent-detail";

export const metadata: Metadata = { title: "Aluguel" };

export default function RentDetailPage() {
  return (
    <RequirePermission permission="invoices.view">
      <Suspense fallback={<FullPageLoading />}>
        <RentDetail />
      </Suspense>
    </RequirePermission>
  );
}
