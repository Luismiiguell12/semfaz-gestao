"use client";

import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      richColors
      toastOptions={{ classNames: { toast: "font-sans text-sm" } }}
      // Leitores de tela anunciam as mensagens de sucesso e erro.
      containerAriaLabel="Notificações do sistema"
    />
  );
}

export { Toaster };
