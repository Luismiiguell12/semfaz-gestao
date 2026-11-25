import { Suspense } from "react";
import type { Metadata } from "next";
import { FullPageLoading } from "@/components/shared/states";
import { TaskDetail } from "./task-detail";

export const metadata: Metadata = { title: "Demanda" };

export default function TaskDetailPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <TaskDetail />
    </Suspense>
  );
}
