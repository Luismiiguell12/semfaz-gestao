"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = SheetPrimitive.Title;
const SheetDescription = SheetPrimitive.Description;

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="bg-brand/45 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50" />
      <SheetPrimitive.Content
        className={cn(
          "data-[state=open]:animate-in fixed inset-y-0 z-50 flex w-[86%] max-w-sm flex-col shadow-xl data-[state=open]:duration-200",
          side === "left"
            ? "data-[state=open]:slide-in-from-left left-0"
            : "data-[state=open]:slide-in-from-right right-0",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="focus-visible:outline-ring absolute top-3.5 right-3.5 cursor-pointer rounded-md p-1.5 opacity-80 hover:opacity-100 focus-visible:outline-2">
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">Fechar menu</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
