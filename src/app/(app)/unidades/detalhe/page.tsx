import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { UnitDetail } from "./unit-detail";

export const metadata: Metadata = { title: "Unidade consumidora" };

export default function UnitDetailPage() {
  return (
    <RequirePermission permission="utilities.view">
      <Suspense fallback={<FullPageLoading />}>
        <UnitDetail />
      </Suspense>
    </RequirePermission>
  );
}
