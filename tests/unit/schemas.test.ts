import { describe, expect, it } from "vitest";
import { inviteUserSchema, setUserStatusSchema, usernameSchema } from "@shared/schemas/users.ts";
import { departmentSchema } from "@shared/schemas/organization.ts";
import { newPasswordSchema, safeNextPath } from "@/schemas/auth";

const UUID = "00000000-0000-4000-8000-000000000201";

describe("schemas compartilhados", () => {
  it("valida convite com as mesmas regras do banco", () => {
    const ok = inviteUserSchema.safeParse({
      full_name: "Maria Teste",
      email: " Maria@Teste.Invalid ",
      username: "maria.teste",
      role_ids: [UUID],
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("maria@teste.invalid");
    expect(
      inviteUserSchema.safeParse({ full_name: "Maria", email: "x", username: "m", role_ids: [] }).success,
    ).toBe(false);
  });

  it("nome de usuário segue o padrão da constraint", () => {
    expect(usernameSchema.safeParse("joao.silva").success).toBe(true);
    expect(usernameSchema.safeParse("JOAO").data).toBe("joao");
    expect(usernameSchema.safeParse("a!").success).toBe(false);
  });

  it("justificativa exige no mínimo 10 caracteres", () => {
    expect(setUserStatusSchema.safeParse({ user_id: UUID, status: "blocked", reason: "curta" }).success).toBe(
      false,
    );
    expect(
      setUserStatusSchema.safeParse({ user_id: UUID, status: "blocked", reason: "Motivo suficiente" })
        .success,
    ).toBe(true);
  });

  it("hierarquia de departamentos", () => {
    expect(departmentSchema.safeParse({ kind: "secretariat", name: "Secretaria X" }).success).toBe(true);
    expect(departmentSchema.safeParse({ kind: "unit", name: "Unidade X" }).success).toBe(false);
    expect(departmentSchema.safeParse({ kind: "secretariat", name: "Sec", parent_id: UUID }).success).toBe(
      false,
    );
  });

  it("política de senha", () => {
    expect(newPasswordSchema.safeParse({ password: "Fraca123", confirm: "Fraca123" }).success).toBe(false);
    expect(
      newPasswordSchema.safeParse({ password: "SenhaForte2026", confirm: "SenhaForte2026" }).success,
    ).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "SenhaForte2026", confirm: "Outra" }).success).toBe(false);
  });

  it("impede redirecionamento aberto após o login", () => {
    expect(safeNextPath("/administracao/usuarios/")).toBe("/administracao/usuarios/");
    expect(safeNextPath("//site-malicioso.example")).toBe("/");
    expect(safeNextPath("https://site-malicioso.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
