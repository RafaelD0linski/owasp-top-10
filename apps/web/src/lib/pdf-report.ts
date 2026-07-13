import PDFDocument from "pdfkit";

type Finding = {
  owaspId: string;
  title: string;
  severity: string;
  status: string;
  evidence: string;
  risk: string;
  recommendation: string;
};

type ReportInput = {
  id: string;
  score: number | null;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  target: { label: string; url: string };
  findings: Finding[];
};

const COLORS = {
  ink: "#14201a",
  muted: "#5a6b62",
  line: "#d7e0da",
  accent: "#0f7a4a",
  bgSoft: "#eef6f1",
  risk: "#8a5a00",
  white: "#ffffff",
  critical: "#8b1a1a",
  high: "#c0392b",
  medium: "#b7791f",
  low: "#2b6cb0",
  info: "#718096",
};

function severityColor(sev: string) {
  return (
    {
      critical: COLORS.critical,
      high: COLORS.high,
      medium: COLORS.medium,
      low: COLORS.low,
      info: COLORS.info,
    }[sev] || COLORS.info
  );
}

function severityWeight(s: string) {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s] ?? 5;
}

function textHeight(doc: PDFKit.PDFDocument, text: string, width: number) {
  doc.font("Helvetica").fontSize(10);
  return doc.heightOfString(text || " ", { width });
}

export async function buildPdfReport(scan: ReportInput): Promise<Buffer> {
  const problems = [...scan.findings]
    .filter((f) => f.status === "fail" || f.status === "manual")
    .sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));

  const fails = scan.findings.filter((f) => f.status === "fail").length;
  const manuals = scan.findings.filter((f) => f.status === "manual").length;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      bufferPages: true,
      margins: { top: 48, bottom: 56, left: 48, right: 48 },
      info: {
        Title: `Relatório OWASP — ${scan.target.label}`,
        Author: "OWASP Scan Lab",
        Subject: "Relatório de segurança autorizada",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 110).fill(COLORS.ink);
    doc
      .fillColor(COLORS.accent)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("OWASP SCAN LAB", 48, 28);
    doc
      .fillColor(COLORS.white)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("Relatório de Segurança", 48, 48);
    doc
      .fillColor("#a8c4b5")
      .font("Helvetica")
      .fontSize(10)
      .text("Uso autorizado apenas · OWASP Top 10 MVP", 48, 78);

    const scoreText = String(scan.score ?? "—");
    doc.roundedRect(doc.page.width - 120, 28, 72, 54, 8).fill(COLORS.accent);
    doc
      .fillColor(COLORS.white)
      .font("Helvetica")
      .fontSize(8)
      .text("SCORE", doc.page.width - 120, 36, { width: 72, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(scoreText, doc.page.width - 120, 50, {
        width: 72,
        align: "center",
      });

    let y = 130;

    doc.roundedRect(48, y, pageWidth, 78, 10).fill(COLORS.bgSoft);
    doc
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(scan.target.label, 64, y + 14, { width: pageWidth - 32 });
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(10)
      .text(scan.target.url, 64, y + 34, { width: pageWidth - 32 });
    doc.text(
      `Status: ${scan.status}  ·  Falhas: ${fails}  ·  Assistidos: ${manuals}  ·  Findings: ${scan.findings.length}`,
      64,
      y + 52,
      { width: pageWidth - 32 }
    );
    y += 100;

    doc
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Achados prioritários", 48, y);
    y += 22;

    if (problems.length === 0) {
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(11)
        .text("Nenhuma falha ou item assistido neste scan.", 48, y);
    }

    const bodyWidth = pageWidth - 36;

    for (const f of problems) {
      const risk = f.risk || "Revise o impacto no contexto do seu sistema.";
      const blocks = [
        { label: "EVIDÊNCIA", text: f.evidence, color: COLORS.muted },
        { label: "RISCO PARA A APLICAÇÃO", text: risk, color: COLORS.risk },
        {
          label: "COMO CORRIGIR",
          text: f.recommendation,
          color: COLORS.accent,
        },
      ];

      let contentHeight = 52;
      for (const b of blocks) {
        contentHeight += 18 + textHeight(doc, b.text, bodyWidth) + 10;
      }
      contentHeight += 8;

      if (y + contentHeight > doc.page.height - 70) {
        doc.addPage();
        y = 48;
      }

      const cardTop = y;
      doc
        .roundedRect(48, cardTop, pageWidth, contentHeight, 10)
        .lineWidth(1)
        .strokeColor(COLORS.line)
        .fillAndStroke(COLORS.white, COLORS.line);

      doc
        .roundedRect(48, cardTop, 6, contentHeight, 3)
        .fill(severityColor(f.severity));

      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(9)
        .text(f.owaspId, 64, cardTop + 12);
      doc
        .fillColor(COLORS.ink)
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(f.title, 64, cardTop + 26, { width: pageWidth - 140 });

      doc
        .roundedRect(48 + pageWidth - 78, cardTop + 14, 62, 16, 4)
        .fill(severityColor(f.severity));
      doc
        .fillColor(COLORS.white)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(f.severity.toUpperCase(), 48 + pageWidth - 78, cardTop + 18, {
          width: 62,
          align: "center",
        });

      let cy = cardTop + 50;
      for (const b of blocks) {
        doc
          .fillColor(b.color)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(b.label, 64, cy);
        cy += 12;
        doc
          .fillColor(COLORS.ink)
          .font("Helvetica")
          .fontSize(10)
          .text(b.text, 64, cy, { width: bodyWidth, align: "left" });
        cy += textHeight(doc, b.text, bodyWidth) + 10;
      }

      y = cardTop + contentHeight + 12;
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(
          `OWASP Scan Lab · ${scan.id} · página ${i + 1}/${range.count}`,
          48,
          doc.page.height - 36,
          { width: pageWidth, align: "center" }
        );
    }

    doc.end();
  });
}
