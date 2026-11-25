"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
      <DropdownMenuTrigger className="hover:bg-muted focus-visible:outline-ring flex cursor-pointer items-center gap-2.5 rounded-md py-1 pr-1 pl-1 focus-visible:outline-2 sm:pr-2.5">
        <span className="sr-only">Menu do usuário </span>
        <span
          className="bg-brand text-brand-foreground flex size-8 items-center justify-center rounded-full text-xs font-bold"
          aria-hidden="true"
        >
          {initials(name) || "?"}
        </span>
        <span className="sr-only md:hidden">{name}</span>
        <span className="hidden max-w-40 text-left leading-tight md:block">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="text-muted-foreground block truncate text-xs">{roles}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold">{name}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {access?.profile?.email}
          </span>
          {access?.department && (
            <span className="text-muted-foreground mt-1 block truncate text-xs font-normal">
              {access.department.name}
            </span>
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
