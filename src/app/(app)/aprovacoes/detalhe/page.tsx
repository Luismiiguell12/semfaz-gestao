import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { ApprovalDetail } from "./approval-detail";

export const metadata: Metadata = { title: "Solicitação" };

export default function ApprovalDetailPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <ApprovalDetail />
    </Suspense>
  );
}
