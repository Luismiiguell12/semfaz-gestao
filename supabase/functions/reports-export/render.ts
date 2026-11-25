// Geração dos arquivos: Excel (ExcelJS) e PDF (pdf-lib, JavaScript puro que roda no Deno).
import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { type Column, formatCell, type Row } from "../_shared/reports/catalog.ts";

export interface Header {
  title: string;
  filters: string;
  generatedBy: string;
  generatedAt: Date;
  notice?: string;
}

const ORG_LINE = "SEMFAZ Gestão · Prefeitura Municipal de Lagarto · Secretaria Municipal da Fazenda";
const when = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Maceio",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", "");

// ------------------------------------------------------------ Excel
export async function toXlsx(h: Header, columns: Column[], rows: Row[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SEMFAZ Gestão";
  wb.created = h.generatedAt;
  const ws = wb.addWorksheet(h.title.slice(0, 31).replace(/[\\/*?:[\]]/g, "-"), {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  ws.addRow([ORG_LINE]).font = { size: 9, color: { argb: "FF5B6577" } };
  ws.addRow([h.title]).font = { size: 14, bold: true, color: { argb: "FF0B2545" } };
  ws.addRow([`Filtros: ${h.filters}`]).font = { size: 9 };
  ws.addRow([`Gerado em ${when(h.generatedAt)} por ${h.generatedBy} · ${rows.length} linha(s)`]).font = {
    size: 9,
  };
  ws.addRow([h.notice ?? ""]).font = { size: 9, italic: true, color: { argb: "FF8A5A00" } };

  const header = ws.addRow(columns.map((c) => c.label));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  for (const r of rows) {
    ws.addRow(
      columns.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined || v === "") return null;
        if (c.type === "money" || c.type === "number" || c.type === "percent") return Number(v);
        if (c.type === "date") return new Date(`${String(v).slice(0, 10)}T12:00:00Z`);
        if (c.type === "datetime") return when(new Date(String(v)));
        if (c.type === "competence") return formatCell("competence", v);
        if (c.type === "bool") return v ? "Sim" : "Não";
        return String(v);
      }),
    );
  }
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.round(10 + (c.width ?? 1) * 10);
    if (c.type === "money") col.numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
    if (c.type === "number") col.numFmt = "#,##0.###";
    if (c.type === "percent") col.numFmt = '0.0"%"';
    if (c.type === "date") col.numFmt = "dd/mm/yyyy";
  });
  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: columns.length } };
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

// ------------------------------------------------------------ PDF
/** As fontes padrão do PDF usam WinAnsi: troca o que não for representável. */
function winAnsi(s: string): string {
  const extra = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
  return s
    .normalize("NFC")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[→]/g, "->")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (ch === "\n" || ch === "\t") return " ";
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || extra.includes(ch)) return ch;
      return "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = winAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(tryLine, size) <= width) {
      line = tryLine;
      continue;
    }
    if (line) lines.push(line);
    // Palavra maior que a coluna: quebra por caracteres.
    let rest = w;
    while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
      let n = rest.length;
      while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n--;
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines.slice(0, 6) : [""];
}

export async function toPdf(h: Header, columns: Column[], rows: Row[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(h.title));
  doc.setCreator("SEMFAZ Gestão");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842;
  const H = 595;
  const M = 32;
  const size = 7.5;
  const lineH = 9.5;
  const pad = 3;
  const totalW = W - 2 * M;
  const weights = columns.map((c) => c.width ?? 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / sum) * totalW);
  const navy = rgb(0.043, 0.145, 0.271);
  const grey = rgb(0.36, 0.4, 0.47);
  const rightAligned = new Set(["money", "number", "percent"]);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  function drawCells(cells: string[][], yTop: number, font_: PDFFont, color = rgb(0.1, 0.1, 0.12)) {
    let x = M;
    cells.forEach((lines, i) => {
      lines.forEach((ln, j) => {
        const tw = font_.widthOfTextAtSize(ln, size);
        const tx = rightAligned.has(columns[i]!.type) ? x + widths[i]! - pad - tw : x + pad;
        page.drawText(ln, { x: tx, y: yTop - pad - size - j * lineH + 1, size, font: font_, color });
      });
      x += widths[i]!;
    });
  }

  function tableHeader() {
    const cells = columns.map((c, i) => wrap(c.label, bold, size, widths[i]! - 2 * pad));
    const hgt = Math.max(...cells.map((l) => l.length)) * lineH + 2 * pad;
    page.drawRectangle({ x: M, y: y - hgt, width: totalW, height: hgt, color: navy });
    drawCells(cells, y, bold, rgb(1, 1, 1));
    y -= hgt;
  }

  function newPage(first: boolean) {
    page = doc.addPage([W, H]);
    pages.push(page);
    y = H - M;
    page.drawText(winAnsi(ORG_LINE), { x: M, y: y - 8, size: 8, font, color: grey });
    y -= 14;
    if (first) {
      page.drawText(winAnsi(h.title), { x: M, y: y - 14, size: 15, font: bold, color: navy });
      y -= 22;
      for (const ln of wrap(`Filtros: ${h.filters}`, font, 8.5, totalW)) {
        page.drawText(ln, { x: M, y: y - 9, size: 8.5, font });
        y -= 11;
      }
      page.drawText(
        winAnsi(`Gerado em ${when(h.generatedAt)} por ${h.generatedBy} · ${rows.length} linha(s)`),
        {
          x: M,
          y: y - 9,
          size: 8.5,
          font,
          color: grey,
        },
      );
      y -= 13;
      if (h.notice) {
        for (const ln of wrap(h.notice, bold, 8.5, totalW)) {
          page.drawText(ln, { x: M, y: y - 9, size: 8.5, font: bold, color: rgb(0.54, 0.35, 0) });
          y -= 11;
        }
      }
      y -= 6;
    } else {
      page.drawText(winAnsi(`${h.title} (continuação)`), {
        x: M,
        y: y - 10,
        size: 10,
        font: bold,
        color: navy,
      });
      y -= 18;
    }
    tableHeader();
  }

  newPage(true);
  if (rows.length === 0) {
    page.drawText("Nenhum registro com os filtros informados.", {
      x: M + pad,
      y: y - 16,
      size: 9,
      font,
      color: grey,
    });
  }
  rows.forEach((r, idx) => {
    const cells = columns.map((c, i) =>
      wrap(formatCell(c.type, r[c.key] ?? null), font, size, widths[i]! - 2 * pad),
    );
    const hgt = Math.max(...cells.map((l) => l.length)) * lineH + 2 * pad;
    if (y - hgt < M + 18) newPage(false);
    if (idx % 2 === 1)
      page.drawRectangle({ x: M, y: y - hgt, width: totalW, height: hgt, color: rgb(0.95, 0.96, 0.98) });
    drawCells(cells, y, font);
    page.drawLine({
      start: { x: M, y: y - hgt },
      end: { x: M + totalW, y: y - hgt },
      thickness: 0.3,
      color: rgb(0.85, 0.87, 0.9),
    });
    y -= hgt;
  });
  pages.forEach((p, i) =>
    p.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: W - M - font.widthOfTextAtSize(`Página ${i + 1} de ${pages.length}`, 8),
      y: M - 14,
      size: 8,
      font,
      color: grey,
    }),
  );
  return await doc.save();
}
