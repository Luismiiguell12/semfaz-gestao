import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { RequirePermission } from "@/components/auth/route-guard";
import { LandlordDetail } from "./landlord-detail";

export const metadata: Metadata = { title: "Locador" };

export default function LandlordDetailPage() {
  return (
    <RequirePermission permission="landlords.view">
      <Suspense fallback={<FullPageLoading />}>
        <LandlordDetail />
      </Suspense>
    </RequirePermission>
  );
}
