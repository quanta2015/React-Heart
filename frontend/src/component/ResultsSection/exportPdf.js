import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import fontRegular from "@/util/pdfFonts";
import fontBold from "@/util/pdfFonts";
import { message } from "antd";

const REPORT_TITLE = "心理测评报告";

const RISK_TEXT_MAP = {
  R0: "低风险",
  R1: "轻度关注",
  R2: "中度风险",
  R3: "高风险",
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

export const registerPdfFonts = (pdf) => {
  if (pdf.__fontRegistered__) {
    pdf.setFont("NotoSansSC", "normal");
    return;
  }

  pdf.addFileToVFS("NotoSansSC-Regular.ttf", fontRegular);
  pdf.addFont("NotoSansSC-Regular.ttf", "NotoSansSC", "normal");

  pdf.addFileToVFS("NotoSansSC-Bold.ttf", fontBold);
  pdf.addFont("NotoSansSC-Bold.ttf", "NotoSansSC", "bold");

  pdf.__fontRegistered__ = true;
  pdf.setFont("NotoSansSC", "normal");
};

export const setPdfFont = (pdf, style = "normal", size = 11) => {
  pdf.setFont("NotoSansSC", style);
  pdf.setFontSize(size);
};

export const exportPageAsImage = async (pdf, pageEl, isFirstPage = false) => {
  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgProps = pdf.getImageProperties(imgData);

  const imgWidth = imgProps.width;
  const imgHeight = imgProps.height;
  const imgRatio = imgWidth / imgHeight;
  const pageRatio = pdfWidth / pdfHeight;

  let renderWidth = 0;
  let renderHeight = 0;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > pageRatio) {
    renderWidth = pdfWidth;
    renderHeight = pdfWidth / imgRatio;
    offsetY = (pdfHeight - renderHeight) / 2;
  } else {
    renderHeight = pdfHeight;
    renderWidth = pdfHeight * imgRatio;
    offsetX = (pdfWidth - renderWidth) / 2;
  }

  if (!isFirstPage) {
    pdf.addPage();
  }

  pdf.addImage(imgData, "JPEG", offsetX, offsetY, renderWidth, renderHeight);
};

export const drawPdfHeader = (pdf, pageNo, schoolName) => {
  const pageWidth = pdf.internal.pageSize.getWidth();

  setPdfFont(pdf, "normal", 10);
  pdf.setTextColor(120, 120, 120);

  pdf.text(schoolName || "XX 学校", 15, 12);
  pdf.text(REPORT_TITLE, pageWidth / 2, 12, { align: "center" });
  pdf.text(`第 ${pageNo} 页`, pageWidth - 15, 12, { align: "right" });

  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, 16, pageWidth - 15, 16);
};

export const splitText = (pdf, text, maxWidth) => {
  if (!text) return [];
  setPdfFont(pdf, "normal", 11);
  return pdf.splitTextToSize(String(text), maxWidth);
};

export const ensurePageSpace = (pdf, currentY, neededHeight, pageNoRef) => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - 15;

  if (currentY + neededHeight > bottomLimit) {
    pdf.addPage();
    pageNoRef.current += 1;
    drawPdfHeader(pdf, pageNoRef.current);
    return 24;
  }

  return currentY;
};

export const drawSectionTitle = (pdf, title, y, pageNoRef) => {
  y = ensurePageSpace(pdf, y, 12, pageNoRef);

  setPdfFont(pdf, "bold", 14);
  pdf.setTextColor(40, 40, 40);
  pdf.text(String(title), 15, y);

  pdf.setDrawColor(230, 230, 230);
  pdf.line(15, y + 2, 195, y + 2);

  return y + 8;
};

export const drawParagraph = (pdf, text, y, pageNoRef, options = {}) => {
  const { x = 15, width = 180, fontSize = 11, lineHeight = 6.5, color = [60, 60, 60], bold = false } = options;

  setPdfFont(pdf, bold ? "bold" : "normal", fontSize);
  const lines = pdf.splitTextToSize(String(text || ""), width);
  const blockHeight = Math.max(lines.length * lineHeight, lineHeight);

  y = ensurePageSpace(pdf, y, blockHeight, pageNoRef);

  setPdfFont(pdf, bold ? "bold" : "normal", fontSize);
  pdf.setTextColor(...color);

  lines.forEach((line, index) => {
    pdf.text(String(line), x, y + index * lineHeight);
  });

  return y + blockHeight;
};

export const drawBulletList = (pdf, title, items, y, pageNoRef) => {
  y = ensurePageSpace(pdf, y, 12, pageNoRef);

  setPdfFont(pdf, "bold", 12);
  pdf.setTextColor(45, 45, 45);
  pdf.text(String(title), 15, y);
  y += 7;

  const list = Array.isArray(items) ? items : [];

  for (let i = 0; i < list.length; i++) {
    setPdfFont(pdf, "normal", 11);
    const text = `- ${list[i] || ""}`;
    const lines = pdf.splitTextToSize(text, 172);
    const blockHeight = Math.max(lines.length * 6, 6);

    y = ensurePageSpace(pdf, y, blockHeight + 2, pageNoRef);

    setPdfFont(pdf, "normal", 11);
    pdf.setTextColor(70, 70, 70);

    lines.forEach((line, lineIndex) => {
      pdf.text(String(line), 20, y + lineIndex * 6);
    });

    y += blockHeight + 2;
  }

  return y + 2;
};

export const drawKeyValueRow = (pdf, label, value, y, pageNoRef) => {
  const labelWidth = 34;
  const valueWidth = 180 - labelWidth;

  setPdfFont(pdf, "normal", 11);
  const lines = pdf.splitTextToSize(String(value || "-"), valueWidth);
  const blockHeight = Math.max(lines.length * 6, 6);

  y = ensurePageSpace(pdf, y, blockHeight + 2, pageNoRef);

  setPdfFont(pdf, "bold", 11);
  pdf.setTextColor(45, 45, 45);
  pdf.text(String(label), 15, y);

  setPdfFont(pdf, "normal", 11);
  pdf.setTextColor(70, 70, 70);
  lines.forEach((line, idx) => {
    pdf.text(String(line), 15 + labelWidth, y + idx * 6);
  });

  return y + blockHeight + 2;
};

export const drawInfoBox = (pdf, title, content, y, pageNoRef, options = {}) => {
  const {
    x = 15,
    width = 180,
    padding = 5,
    titleFontSize = 12,
    contentFontSize = 11,
    lineHeight = 6,
    fillColor = [248, 250, 252],
    borderColor = [220, 220, 220]
  } = options;

  setPdfFont(pdf, "bold", titleFontSize);
  const titleLines = pdf.splitTextToSize(String(title || ""), width - padding * 2);

  setPdfFont(pdf, "normal", contentFontSize);
  const contentLines = pdf.splitTextToSize(String(content || ""), width - padding * 2);

  const titleHeight = titleLines.length * lineHeight;
  const contentHeight = contentLines.length * lineHeight;
  const totalHeight = padding + titleHeight + 3 + contentHeight + padding + 4;

  y = ensurePageSpace(pdf, y, totalHeight + 2, pageNoRef);

  pdf.setFillColor(...fillColor);
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(x, y, width, totalHeight, 2, 2, "FD");

  setPdfFont(pdf, "bold", titleFontSize);
  pdf.setTextColor(40, 40, 40);
  titleLines.forEach((line, idx) => {
    pdf.text(String(line), x + padding, y + padding + 5 + idx * lineHeight);
  });

  const contentStartY = y + padding + titleHeight + 4;

  setPdfFont(pdf, "normal", contentFontSize);
  pdf.setTextColor(75, 75, 75);
  contentLines.forEach((line, idx) => {
    pdf.text(String(line), x + padding, contentStartY + 4 + idx * lineHeight);
  });

  return y + totalHeight + 6;
};

export const drawThirdPageContent = (pdf, suggestion, pageNoRef, schoolName) => {
  pdf.addPage();
  pageNoRef.current += 1;
  drawPdfHeader(pdf, pageNoRef.current, schoolName);

  let y = 26;

  y = drawSectionTitle(pdf, "分析说明", y, pageNoRef);

  const riskTextForSuggestion = RISK_TEXT_MAP[suggestion?.risk_level] || suggestion?.risk_level || "";

  const summaryHeader = `${suggestion?.summary_level || ""}${
    riskTextForSuggestion ? ` / ${riskTextForSuggestion}` : ""
  }`;

  if (summaryHeader) {
    y = drawParagraph(pdf, summaryHeader, y, pageNoRef, {
      fontSize: 11,
      bold: true,
      color: [25, 25, 25]
    });
    y += 1;
  }

  if (suggestion?.summary_title) {
    y = drawParagraph(pdf, suggestion.summary_title, y, pageNoRef, {
      fontSize: 13,
      bold: true,
      color: [35, 35, 35]
    });
    y += 2;
  }

  if (suggestion?.summary_content) {
    y = drawParagraph(pdf, suggestion.summary_content, y, pageNoRef, {
      fontSize: 11,
      lineHeight: 6.5,
      color: [70, 70, 70]
    });
    y += 4;
  }

  if (Array.isArray(suggestion?.priority_domains) && suggestion.priority_domains.length > 0) {
    y = drawKeyValueRow(pdf, "重点关注维度：", suggestion.priority_domains.join("、"), y, pageNoRef);
    y += 2;
  }

  if (suggestion?.refer_required) {
    y = drawInfoBox(
      pdf,
      "建议人工复核 / 专业转介",
      "当前结果提示需要重点关注，建议由心理老师进一步访谈评估，并根据实际情况决定是否转介专业机构。",
      y,
      pageNoRef,
      {
        fillColor: [255, 251, 230],
        borderColor: [250, 173, 20]
      }
    );
  }

  y = drawSectionTitle(pdf, "建议措施", y, pageNoRef);

  y = drawBulletList(pdf, "给学生的建议", suggestion?.student_advice || [], y, pageNoRef);
  y = drawBulletList(pdf, "给教师的建议", suggestion?.teacher_advice || [], y, pageNoRef);
  y = drawBulletList(pdf, "给家长的建议", suggestion?.parent_advice || [], y, pageNoRef);

  y = drawSectionTitle(pdf, "后续跟进", y, pageNoRef);

  y = drawKeyValueRow(
    pdf,
    "建议动作：",
    Array.isArray(suggestion?.actions) ? suggestion.actions.join("、") : "-",
    y,
    pageNoRef
  );

  y = drawKeyValueRow(
    pdf,
    "建议复评周期：",
    suggestion?.followup_days ? `${suggestion.followup_days} 天内` : "-",
    y,
    pageNoRef
  );

  if (Array.isArray(suggestion?.matched_rules) && suggestion.matched_rules.length > 0) {
    y = drawKeyValueRow(pdf, "命中规则：", suggestion.matched_rules.join("、"), y, pageNoRef);
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}年${month}月${day}日 ${hours}:${minutes}`;
};

export const handleExportPdf = async ({ reportRef, result, suggestion, user, setExporting, pages }) => {
  if (!reportRef.current || !result) return;

  try {
    setExporting(true);

    const pdf = new jsPDF("p", "mm", "a4");
    registerPdfFonts(pdf);

    console.log(pdf.getFontList());

    const pageNoRef = { current: 1 };

    if (pages[0]) {
      await exportPageAsImage(pdf, pages[0], true);
    }

    if (pages[1]) {
      pageNoRef.current = 2;
      await exportPageAsImage(pdf, pages[1], false);
    }

    if (suggestion) {
      pageNoRef.current = 2;
      drawThirdPageContent(pdf, suggestion, pageNoRef, user?.school_name);
    }

    const displayTime = result.finished_at || result.created_at;
    const safeName = user?.real_name || "学生";
    const fileName = `${safeName}_心理测评报告_${formatDate(displayTime)
      .replace(/[年月]/g, "-")
      .replace(/[日]/g, "")
      .replace(" ", "_")
      .replace(/:/g, "-")}.pdf`;

    pdf.save(fileName);
    message.success("PDF 导出成功");
  } catch (error) {
    console.error("导出 PDF 失败:", error);
    message.error("PDF 导出失败，请稍后重试");
  } finally {
    setExporting(false);
  }
};
