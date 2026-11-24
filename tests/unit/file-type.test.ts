import { describe, expect, it } from "vitest";
import { detectKind, extensionMatches, sanitizeFileName, sha256Hex } from "@shared/file-type.ts";

const enc = (s: string) => new TextEncoder().encode(s);

describe("detecção do tipo real de arquivo", () => {
  it("reconhece PDF, PNG e JPG pela assinatura", () => {
    expect(detectKind(enc("%PDF-1.7 ..."))).toBe("pdf");
    expect(detectKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(detectKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
  });

  it("distingue DOCX e XLSX dentro do pacote ZIP", () => {
    const zip = (inner: string) =>
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...enc(`[Content_Types].xml ${inner}`)]);
    expect(detectKind(zip("word/document.xml"))).toBe("docx");
    expect(detectKind(zip("xl/workbook.xml"))).toBe("xlsx");
    expect(detectKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...enc("qualquer.zip")]))).toBeNull();
  });

  it("rejeita conteúdo não permitido", () => {
    expect(detectKind(enc("MZ executável"))).toBeNull();
    expect(detectKind(enc("<html>"))).toBeNull();
  });

  it("exige coerência entre extensão e conteúdo", () => {
    expect(extensionMatches("pdf", "contrato.PDF")).toBe(true);
    expect(extensionMatches("jpg", "foto.jpeg")).toBe(true);
    expect(extensionMatches("png", "disfarce.pdf")).toBe(false);
  });

  it("higieniza o nome exibido", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeFileName("a\u0000b.pdf")).toBe("a_b.pdf");
  });

  it("calcula SHA-256", async () => {
    expect(await sha256Hex(enc("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
