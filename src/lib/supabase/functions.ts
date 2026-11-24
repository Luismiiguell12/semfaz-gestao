"use client";

import { getSupabase } from "./client";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Chama uma Edge Function com o JWT do usuário e traduz erros. */
export async function invokeFunction<T>(name: string, body: BodyInit | object): Promise<T> {
  const supabase = getSupabase();
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new AppError("Sua sessão expirou. Entre novamente.");
  const isForm = body instanceof FormData;
  const res = await fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      ...(isForm ? {} : { "Content-Type": "application/json" }),
    },
    body: isForm ? body : JSON.stringify(body),
  }).catch(() => {
    throw new AppError("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string; warning?: string } & T;
  if (!res.ok) throw new AppError(payload.error ?? "Não foi possível concluir a operação.");
  return payload;
}
