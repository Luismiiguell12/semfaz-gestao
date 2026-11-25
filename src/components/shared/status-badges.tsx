import { Badge } from "@/components/ui/badge";
import { APPROVAL_STATUS_LABEL, type ApprovalStatus } from "@/modules/approvals/api";
import { PROPERTY_STATUS_LABEL, type PropertyStatus } from "@/modules/properties/api";
import { VALIDITY_LABEL, type ValidityStatus } from "@/modules/contracts/api";

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const tone = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    cancelled: "neutral",
    failed: "danger",
  } as const;
  return <Badge tone={tone[status]}>{APPROVAL_STATUS_LABEL[status]}</Badge>;
}

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  const tone = { active: "success", inactive: "neutral", vacated: "warning" } as const;
  return <Badge tone={tone[status]}>{PROPERTY_STATUS_LABEL[status]}</Badge>;
}

export function ValidityBadge({ status }: { status: string | null }) {
  const s = (status ?? "inactive") as ValidityStatus;
  const tone = {
    not_started: "info",
    active: "success",
    expiring: "warning",
    expired: "danger",
    inactive: "neutral",
  } as const;
  return <Badge tone={tone[s]}>{VALIDITY_LABEL[s]}</Badge>;
}
