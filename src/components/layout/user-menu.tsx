"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";
import { initials } from "@/lib/format";

export function UserMenu() {
  const { access, signOut } = useAuth();
  const router = useRouter();
  const name = access?.profile?.full_name ?? "";
  const roles = access?.roles?.map((r) => r.name).join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 pr-1 pl-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:pr-2.5"
        aria-label={`Menu do usuário ${name}`}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground" aria-hidden="true">
          {initials(name) || "?"}
        </span>
        <span className="hidden max-w-40 text-left leading-tight md:block">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{roles}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{access?.profile?.email}</span>
          {access?.department && (
            <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{access.department.name}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/minha-conta/">
            <UserRound aria-hidden="true" /> Minha conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.replace("/login/");
          }}
        >
          <LogOut aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
