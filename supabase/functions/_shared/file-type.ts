// Detecção do tipo REAL do arquivo pela assinatura binária (magic bytes),
// independentemente da extensão ou do Content-Type informados pelo cliente.

export type AllowedKind = "pdf" | "jpg" | "png" | "docx" | "xlsx";

export const MIME_BY_KIND: Record<AllowedKind, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const EXTENSIONS: Record<AllowedKind, string[]> = {
  pdf: ["pdf"],
  jpg: ["jpg", "jpeg"],
  png: ["png"],
  docx: ["docx"],
  xlsx: ["xlsx"],
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function containsAscii(bytes: Uint8Array, text: string): boolean {
  const needle = new TextEncoder().encode(text);
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Retorna o tipo detectado ou null quando o conteúdo não é de um tipo permitido. */
export function detectKind(bytes: Uint8Array): AllowedKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // DOCX/XLSX são pacotes ZIP (OOXML). Os nomes das entradas ficam sem compressão.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (!containsAscii(bytes, "[Content_Types].xml")) return null;
    if (containsAscii(bytes, "word/")) return "docx";
    if (containsAscii(bytes, "xl/")) return "xlsx";
  }
  return null;
}

export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : "";
}

/** A extensão do nome original deve corresponder ao conteúdo detectado. */
export function extensionMatches(kind: AllowedKind, fileName: string): boolean {
  return EXTENSIONS[kind].includes(extensionOf(fileName));
}

/** Remove caracteres de controle e separadores de caminho do nome exibido. */
export function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
    .trim();
  return (cleaned || "arquivo").slice(0, 255);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
