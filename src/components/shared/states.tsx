import * as React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="ledger-rule mb-4 flex size-14 items-center justify-center rounded-lg border bg-background">
        <Icon className="size-6 text-brand" aria-hidden="true" />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-[52ch] text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar os dados.",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-8 text-danger" aria-hidden="true" />
      <p className="font-semibold text-foreground">{title}</p>
      {message && <p className="mt-1 max-w-[56ch] text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 5, label = "Carregando" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function FullPageLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function InlineAlert({
  tone = "warning",
  title,
  children,
  className,
}: {
  tone?: "warning" | "danger" | "info" | "success";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    warning: "border-warning-strong/50 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
    info: "border-primary/25 bg-primary-soft text-primary-hover",
    success: "border-success/30 bg-success-soft text-success",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", styles, className)}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={cn(title && "mt-0.5", "text-foreground/85")}>{children}</div>
    </div>
  );
}
