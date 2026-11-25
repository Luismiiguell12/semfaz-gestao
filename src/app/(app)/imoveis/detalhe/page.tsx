import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { PropertyDetail } from "./property-detail";

export const metadata: Metadata = { title: "Imóvel" };

export default function PropertyDetailPage() {
  return (
    <RequirePermission permission="properties.view">
      <Suspense fallback={<FullPageLoading />}>
        <PropertyDetail />
      </Suspense>
    </RequirePermission>
  );
}
