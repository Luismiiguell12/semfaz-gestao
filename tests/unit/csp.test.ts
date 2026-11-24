import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";

describe("Content Security Policy", () => {
  it("restringe conexões ao próprio site e ao Supabase do ambiente", () => {
    const csp = buildCsp("https://abcd.supabase.co", false);
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("permite unsafe-eval somente em desenvolvimento", () => {
    expect(buildCsp("http://127.0.0.1:54321", true)).toContain("'unsafe-eval'");
    expect(buildCsp("http://127.0.0.1:54321", false)).not.toContain("upgrade-insecure-requests");
  });
});
