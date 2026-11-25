import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { TOTP } from "otpauth";

export const PASSWORD = "SenhaTeste123";

export function e2eState(): {
  admin: { id: string; email: string };
  colab: { id: string; email: string };
  manager: { id: string; email: string };
  totpSecret: string;
} {
  return JSON.parse(readFileSync("tests/e2e/.auth/state.json", "utf8"));
}

export async function login(page: Page, email: string) {
  await page.goto("login/");
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Login completo do administrador, incluindo o código TOTP (AAL2). */
export async function loginAdmin(page: Page) {
  const { admin, totpSecret } = e2eState();
  await login(page, admin.email);
  await expect(page.getByRole("heading", { name: "Verificação em duas etapas" })).toBeVisible();
  // Evita reutilizar um código já aceito na mesma janela de 30 s.
  const totp = new TOTP({ secret: totpSecret, digits: 6, period: 30 });
  await page.getByLabel("Código de verificação").fill(totp.generate());
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByRole("heading", { name: /^Olá/ })).toBeVisible();
}

/** A página não pode ter rolagem horizontal (requisito de responsividade). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
