import { describe, expect, it } from "vitest";
import { errorMessage, isMfaRequired } from "@/lib/errors";

describe("mensagens de erro", () => {
  it("traduz erros de autenticação", () => {
    expect(errorMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(errorMessage({ message: "User is banned" })).toContain("bloqueado");
  });

  it("repassa mensagens do banco já escritas em português", () => {
    expect(
      errorMessage({
        code: "42501",
        message: "Você não pode alterar as próprias permissões ou escopos de acesso.",
      }),
    ).toBe("Você não pode alterar as próprias permissões ou escopos de acesso.");
  });

  it("não expõe mensagens técnicas em inglês", () => {
    expect(
      errorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_username_key"',
      }),
    ).toBe("Já existe um registro com esses dados.");
    expect(errorMessage({ message: "relation public.x does not exist" }, "Falhou.")).toBe("Falhou.");
  });

  it("identifica exigência de MFA", () => {
    expect(isMfaRequired({ hint: "mfa_required" })).toBe(true);
    expect(isMfaRequired({ code: "42501", message: "Acesso negado" })).toBe(false);
  });
});
