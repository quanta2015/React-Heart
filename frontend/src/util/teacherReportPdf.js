import jsPDF from "jspdf";
import { message } from "antd";
import fontRegular from "@/util/pdfFonts";
import fontBold from "@/util/pdfFonts";

const REPORT_TITLE = "学校心理测评统计分析报告";

const PDF_THEME = {
  page: {
    marginX: 15,
    topY: 24,
    bottomY: 15,
    contentWidth: 180
  },

  radius: {
    xs: 1.5,
    sm: 2,
    md: 2.5,
    lg: 3
  },

  fontSize: {
    header: 10,
    pageTitle: 16,
    pageSubtitle: 9.5,
    sectionTitle: 13,
    cardTitle: 11.5,
    body: 10.5,
    bodySmall: 9.5,
    caption: 8.5,
    badge: 9,
    table: 8.8
  },

  lineHeight: {
    tight: 4.2,
    normal: 5.2,
    relaxed: 5.8,
    title: 6
  },

  spacing: {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12
  },

  colors: {
    text: {
      title: [32, 41, 52],
      primary: [55, 65, 81],
      secondary: [107, 114, 128],
      light: [148, 163, 184],
      inverse: [255, 255, 255]
    },

    line: {
      light: [226, 232, 240],
      normal: [203, 213, 225],
      strong: [148, 163, 184]
    },

    brand: {
      primary: [91, 141, 166],
      primaryLight: [236, 244, 247],
      primarySoft: [245, 249, 251],
      deep: [58, 90, 106]
    },

    surface: {
      page: [255, 255, 255],
      card: [250, 252, 253],
      muted: [246, 248, 250],
      subtle: [242, 245, 247]
    },

    section: {
      studentBg: [243, 248, 251],
      studentBorder: [191, 214, 224],
      studentTitle: [73, 111, 130],

      teacherBg: [245, 249, 246],
      teacherBorder: [198, 220, 205],
      teacherTitle: [87, 120, 98],

      parentBg: [250, 248, 244],
      parentBorder: [223, 212, 191],
      parentTitle: [136, 110, 76]
    },

    risk: {
      low: {
        fill: [237, 245, 251],
        border: [173, 206, 225],
        text: [74, 119, 145]
      },
      medium: {
        fill: [252, 246, 235],
        border: [230, 195, 129],
        text: [149, 109, 42]
      },
      high: {
        fill: [252, 239, 238],
        border: [219, 153, 149],
        text: [152, 74, 69]
      },
      mild: {
        fill: [242, 247, 240],
        border: [181, 208, 178],
        text: [83, 124, 80]
      }
    },

    alert: {
      fill: [253, 247, 237],
      border: [230, 190, 138],
      title: [138, 101, 45],
      text: [120, 96, 67]
    }
  }
};

const RISK_TEXT_MAP = {
  R0: "低风险",
  R1: "中低风险",
  R2: "中高风险",
  R3: "高风险",
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

const DOMAIN_ALIAS = {
  study_pressure: "学习压力",
  pressure: "学习压力",
  anxiety: "焦虑",
  depression: "抑郁",
  esteem: "自尊",
  self_esteem: "自尊",
  social: "社交",
  network: "网络行为",
  internet: "网络行为"
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

const pad = (n) => String(n).padStart(2, "0");

export const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}年${month}月${day}日 ${hours}:${minutes}`;
};

export const formatDateTimeFile = (dateString) => {
  if (!dateString) return "未知时间";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "未知时间";
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}_${hours}-${minutes}`;
};

const safeNumber = (val, digits = 4) => {
  const num = Number(val);
  if (Number.isNaN(num)) return 0;
  return Number(num.toFixed(digits));
};

const safePercent = (val) => {
  const num = Number(val);
  if (Number.isNaN(num)) return "0.0%";
  return `${(num * 100).toFixed(1)}%`;
};

const getRiskStyle = (riskLevel) => {
  const risk = String(riskLevel || "").toLowerCase();

  if (risk === "r3" || risk === "high") {
    return {
      label: RISK_TEXT_MAP[riskLevel] || "高风险",
      fillColor: PDF_THEME.colors.risk.high.fill,
      borderColor: PDF_THEME.colors.risk.high.border,
      textColor: PDF_THEME.colors.risk.high.text
    };
  }

  if (risk === "r2" || risk === "medium") {
    return {
      label: RISK_TEXT_MAP[riskLevel] || "中风险",
      fillColor: PDF_THEME.colors.risk.medium.fill,
      borderColor: PDF_THEME.colors.risk.medium.border,
      textColor: PDF_THEME.colors.risk.medium.text
    };
  }

  if (risk === "r1") {
    return {
      label: RISK_TEXT_MAP[riskLevel] || "中低风险",
      fillColor: PDF_THEME.colors.risk.mild.fill,
      borderColor: PDF_THEME.colors.risk.mild.border,
      textColor: PDF_THEME.colors.risk.mild.text
    };
  }

  return {
    label: RISK_TEXT_MAP[riskLevel] || "低风险",
    fillColor: PDF_THEME.colors.risk.low.fill,
    borderColor: PDF_THEME.colors.risk.low.border,
    textColor: PDF_THEME.colors.risk.low.text
  };
};

const drawBadge = (pdf, text, x, y, options = {}) => {
  const {
    height = 7,
    paddingX = 4,
    fillColor = PDF_THEME.colors.risk.low.fill,
    borderColor = PDF_THEME.colors.risk.low.border,
    textColor = PDF_THEME.colors.risk.low.text,
    fontSize = PDF_THEME.fontSize.badge,
    bold = true
  } = options;

  setPdfFont(pdf, bold ? "bold" : "normal", fontSize);
  const textWidth = pdf.getTextWidth(String(text || ""));
  const width = textWidth + paddingX * 2;

  pdf.setFillColor(...fillColor);
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(x, y, width, height, PDF_THEME.radius.md, PDF_THEME.radius.md, "FD");

  pdf.setTextColor(...textColor);
  pdf.text(String(text || ""), x + paddingX, y + 4.9);

  return width;
};

const drawPdfHeader = (pdf, pageNo, schoolName) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const { marginX } = PDF_THEME.page;

  setPdfFont(pdf, "normal", PDF_THEME.fontSize.header);
  pdf.setTextColor(...PDF_THEME.colors.text.secondary);

  pdf.text(schoolName || "XX 学校", marginX, 12);
  pdf.text(REPORT_TITLE, pageWidth / 2, 12, { align: "center" });
  pdf.text(`第 ${pageNo} 页`, pageWidth - marginX, 12, { align: "right" });

  pdf.setDrawColor(...PDF_THEME.colors.line.light);
  pdf.line(marginX, 16, pageWidth - marginX, 16);
};

const ensurePageSpace = (pdf, currentY, neededHeight, pageNoRef, schoolName) => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - PDF_THEME.page.bottomY;

  if (currentY + neededHeight > bottomLimit) {
    pdf.addPage();
    pageNoRef.current += 1;
    drawPdfHeader(pdf, pageNoRef.current, schoolName);
    return PDF_THEME.page.topY;
  }

  return currentY;
};

const addNewPage = (pdf, pageNoRef, schoolName) => {
  pdf.addPage();
  pageNoRef.current += 1;
  drawPdfHeader(pdf, pageNoRef.current, schoolName);
  return PDF_THEME.page.topY;
};

const drawSectionTitle = (pdf, title, y, pageNoRef, schoolName, subtitle = "") => {
  y += PDF_THEME.spacing.sm;
  y = ensurePageSpace(pdf, y, 16, pageNoRef, schoolName);

  const x = PDF_THEME.page.marginX;

  setPdfFont(pdf, "bold", PDF_THEME.fontSize.sectionTitle);
  pdf.setTextColor(...PDF_THEME.colors.text.title);
  pdf.text(String(title), x, y);

  if (subtitle) {
    setPdfFont(pdf, "normal", PDF_THEME.fontSize.caption);
    pdf.setTextColor(...PDF_THEME.colors.text.light);
    pdf.text(String(subtitle), x, y + 5);
  }

  pdf.setDrawColor(...PDF_THEME.colors.line.light);
  pdf.line(x, y + 7, x + PDF_THEME.page.contentWidth, y + 7);

  return y + 12;
};

const drawParagraph = (pdf, text, y, pageNoRef, schoolName, options = {}) => {
  const {
    x = PDF_THEME.page.marginX,
    width = PDF_THEME.page.contentWidth,
    fontSize = PDF_THEME.fontSize.body,
    lineHeight = PDF_THEME.lineHeight.relaxed,
    color = PDF_THEME.colors.text.primary,
    bold = false
  } = options;

  setPdfFont(pdf, bold ? "bold" : "normal", fontSize);
  const lines = pdf.splitTextToSize(String(text || ""), width);
  const blockHeight = Math.max(lines.length * lineHeight, lineHeight);

  y = ensurePageSpace(pdf, y, blockHeight + 2, pageNoRef, schoolName);

  setPdfFont(pdf, bold ? "bold" : "normal", fontSize);
  pdf.setTextColor(...color);

  lines.forEach((line, index) => {
    pdf.text(String(line), x, y + index * lineHeight);
  });

  return y + blockHeight;
};

const drawInfoBox = (pdf, title, content, y, pageNoRef, schoolName, options = {}) => {
  const {
    x = PDF_THEME.page.marginX,
    width = PDF_THEME.page.contentWidth,
    padding = 5,
    titleFontSize = 11,
    contentFontSize = PDF_THEME.fontSize.bodySmall,
    lineHeight = PDF_THEME.lineHeight.normal,
    fillColor = PDF_THEME.colors.alert.fill,
    borderColor = PDF_THEME.colors.alert.border
  } = options;

  setPdfFont(pdf, "bold", titleFontSize);
  const titleLines = pdf.splitTextToSize(String(title || ""), width - padding * 2);

  setPdfFont(pdf, "normal", contentFontSize);
  const contentLines = pdf.splitTextToSize(String(content || ""), width - padding * 2);

  const titleHeight = titleLines.length * lineHeight;
  const contentHeight = contentLines.length * lineHeight;
  const totalHeight = padding + titleHeight + 3 + contentHeight + padding + 4;

  y = ensurePageSpace(pdf, y, totalHeight + 2, pageNoRef, schoolName);

  pdf.setFillColor(...fillColor);
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(x, y, width, totalHeight, PDF_THEME.radius.sm, PDF_THEME.radius.sm, "FD");

  setPdfFont(pdf, "bold", titleFontSize);
  pdf.setTextColor(...PDF_THEME.colors.alert.title);
  titleLines.forEach((line, idx) => {
    pdf.text(String(line), x + padding, y + padding + 5 + idx * lineHeight);
  });

  const contentStartY = y + padding + titleHeight + 4;

  setPdfFont(pdf, "normal", contentFontSize);
  pdf.setTextColor(...PDF_THEME.colors.alert.text);
  contentLines.forEach((line, idx) => {
    pdf.text(String(line), x + padding, contentStartY + 4 + idx * lineHeight);
  });

  return y + totalHeight + PDF_THEME.spacing.md;
};

const drawStatCard = (pdf, config, y, pageNoRef, schoolName) => {
  const {
    x,
    width,
    title,
    value,
    subValue = "",
    fillColor = PDF_THEME.colors.surface.card,
    borderColor = PDF_THEME.colors.line.light
  } = config;

  const height = 24;
  y = ensurePageSpace(pdf, y, height + 2, pageNoRef, schoolName);

  pdf.setFillColor(...fillColor);
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(x, y, width, height, PDF_THEME.radius.md, PDF_THEME.radius.md, "FD");

  setPdfFont(pdf, "normal", 9);
  pdf.setTextColor(...PDF_THEME.colors.text.secondary);
  pdf.text(String(title), x + 5, y + 7);

  setPdfFont(pdf, "bold", 17);
  pdf.setTextColor(...PDF_THEME.colors.text.title);
  pdf.text(String(value), x + 5, y + 16);

  if (subValue) {
    setPdfFont(pdf, "normal", 8.5);
    pdf.setTextColor(...PDF_THEME.colors.text.light);
    pdf.text(String(subValue), x + width - 5, y + 16, { align: "right" });
  }

  return y + height;
};

const drawSimpleTable = (pdf, columns, rows, startY, pageNoRef, schoolName, options = {}) => {
  const x = options.x || PDF_THEME.page.marginX;
  const width = options.width || PDF_THEME.page.contentWidth;
  const headerHeight = options.headerHeight || 9;
  const rowMinHeight = options.rowMinHeight || 8;
  const fontSize = options.fontSize || PDF_THEME.fontSize.table;
  const lineHeight = options.lineHeight || 4.5;
  const zebra = options.zebra !== false;

  const colWidths = columns.map((col) => col.width);
  const totalWidth = colWidths.reduce((sum, item) => sum + item, 0);

  let y = startY;

  const drawHeader = () => {
    y = ensurePageSpace(pdf, y, headerHeight + 2, pageNoRef, schoolName);

    pdf.setFillColor(...PDF_THEME.colors.surface.subtle);
    pdf.setDrawColor(...PDF_THEME.colors.line.light);
    pdf.rect(x, y, totalWidth || width, headerHeight, "FD");

    let cursorX = x;

    columns.forEach((col) => {
      pdf.setDrawColor(...PDF_THEME.colors.line.light);
      pdf.line(cursorX, y, cursorX, y + headerHeight);

      setPdfFont(pdf, "bold", fontSize);
      pdf.setTextColor(...PDF_THEME.colors.text.primary);

      const text = String(col.title || "");
      const align = col.align || "left";
      const textX =
        align === "right" ? cursorX + col.width - 2 : align === "center" ? cursorX + col.width / 2 : cursorX + 2;

      pdf.text(text, textX, y + 5.8, {
        align: align === "right" ? "right" : align === "center" ? "center" : "left"
      });

      cursorX += col.width;
    });

    pdf.line(x + totalWidth, y, x + totalWidth, y + headerHeight);
    y += headerHeight;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    const rowLines = columns.map((col) => {
      setPdfFont(pdf, "normal", fontSize);
      const rawText = row[col.dataIndex] ?? "-";
      return pdf.splitTextToSize(String(rawText), col.width - 4);
    });

    const rowHeight = Math.max(
      rowMinHeight,
      ...rowLines.map((lines) => Math.max(lines.length * lineHeight + 3, rowMinHeight))
    );

    if (y + rowHeight > pdf.internal.pageSize.getHeight() - PDF_THEME.page.bottomY) {
      y = addNewPage(pdf, pageNoRef, schoolName);
      drawHeader();
    }

    if (zebra && rowIndex % 2 === 0) {
      pdf.setFillColor(...PDF_THEME.colors.surface.card);
      pdf.rect(x, y, totalWidth, rowHeight, "F");
    }

    let cursorX = x;

    columns.forEach((col, colIndex) => {
      pdf.setDrawColor(...PDF_THEME.colors.line.light);
      pdf.rect(cursorX, y, col.width, rowHeight);

      const align = col.align || "left";
      const lines = rowLines[colIndex];

      setPdfFont(pdf, "normal", fontSize);
      pdf.setTextColor(...PDF_THEME.colors.text.primary);

      lines.forEach((line, idx) => {
        const textX =
          align === "right" ? cursorX + col.width - 2 : align === "center" ? cursorX + col.width / 2 : cursorX + 2;

        pdf.text(String(line), textX, y + 5 + idx * lineHeight, {
          align: align === "right" ? "right" : align === "center" ? "center" : "left"
        });
      });

      cursorX += col.width;
    });

    y += rowHeight;
  });

  return y + 3;
};

const drawRiskDistributionBar = (pdf, riskDist, y, pageNoRef, schoolName, title = "风险等级分布") => {
  const x = PDF_THEME.page.marginX;
  const width = PDF_THEME.page.contentWidth;
  const barY = y + 10;
  const barHeight = 10;

  const r0 = Number(riskDist?.R0 || 0);
  const r1 = Number(riskDist?.R1 || 0);
  const r2 = Number(riskDist?.R2 || 0);
  const r3 = Number(riskDist?.R3 || 0);
  const total = r0 + r1 + r2 + r3 || 1;

  y = ensurePageSpace(pdf, y, 28, pageNoRef, schoolName);

  setPdfFont(pdf, "bold", 11);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text(title, x, y);

  const segments = [
    { label: "R0", value: r0, color: [82, 196, 26], name: "低风险" },
    { label: "R1", value: r1, color: [24, 144, 255], name: "中低风险" },
    { label: "R2", value: r2, color: [250, 140, 22], name: "中高风险" },
    { label: "R3", value: r3, color: [245, 34, 45], name: "高风险" }
  ];

  let cursorX = x;
  segments.forEach((seg) => {
    const segWidth = (seg.value / total) * width;
    if (segWidth > 0) {
      pdf.setFillColor(...seg.color);
      pdf.rect(cursorX, barY, segWidth, barHeight, "F");
      cursorX += segWidth;
    }
  });

  let legendX = x;
  const legendY = barY + 17;

  segments.forEach((seg) => {
    pdf.setFillColor(...seg.color);
    pdf.rect(legendX, legendY - 3.5, 3.5, 3.5, "F");

    setPdfFont(pdf, "normal", 8.5);
    pdf.setTextColor(...PDF_THEME.colors.text.secondary);
    pdf.text(`${seg.name} ${seg.value}人`, legendX + 5, legendY);

    legendX += 40;
  });

  return legendY + 5;
};

const drawDomainAverageBars = (pdf, domainAvg, y, pageNoRef, schoolName) => {
  const x = PDF_THEME.page.marginX;
  const width = PDF_THEME.page.contentWidth;
  const leftWidth = 28;
  const barWidth = 110;

  const entries = Object.entries(domainAvg || {}).map(([key, value]) => ({
    name: key,
    value: safeNumber(value, 4)
  }));

  if (!entries.length) return y;

  y = ensurePageSpace(pdf, y, 14 + entries.length * 10, pageNoRef, schoolName);

  setPdfFont(pdf, "bold", 11);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text("心理维度均值概览", x, y);

  y += 8;

  entries.forEach((item) => {
    y = ensurePageSpace(pdf, y, 9, pageNoRef, schoolName);

    setPdfFont(pdf, "normal", 9.5);
    pdf.setTextColor(...PDF_THEME.colors.text.primary);
    pdf.text(item.name, x, y + 4.5);

    pdf.setFillColor(...PDF_THEME.colors.surface.subtle);
    pdf.roundedRect(x + leftWidth, y + 1.2, barWidth, 5, 1.5, 1.5, "F");

    pdf.setFillColor(...PDF_THEME.colors.brand.primary);
    pdf.roundedRect(x + leftWidth, y + 1.2, Math.max(2, barWidth * item.value), 5, 1.5, 1.5, "F");

    setPdfFont(pdf, "bold", 9);
    pdf.setTextColor(...PDF_THEME.colors.text.secondary);
    pdf.text(item.value.toFixed(2), x + leftWidth + barWidth + 8, y + 4.5, { align: "right" });

    y += 9;
  });

  return y + 2;
};

const drawBulletList = (pdf, title, items, y, pageNoRef, schoolName) => {
  if (!items?.length) return y;

  y = ensurePageSpace(pdf, y, 12, pageNoRef, schoolName);

  setPdfFont(pdf, "bold", 11);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text(String(title), PDF_THEME.page.marginX, y);
  y += 6;

  const list = Array.isArray(items) ? items : [];

  for (let i = 0; i < list.length; i += 1) {
    const text = `• ${list[i] || ""}`;
    setPdfFont(pdf, "normal", 10);
    const lines = pdf.splitTextToSize(text, 172);
    const blockHeight = Math.max(lines.length * 5.2, 5.2);

    y = ensurePageSpace(pdf, y, blockHeight + 2, pageNoRef, schoolName);

    pdf.setTextColor(...PDF_THEME.colors.text.secondary);
    lines.forEach((line, index) => {
      pdf.text(String(line), 18, y + index * 5.2);
    });

    y += blockHeight + 1;
  }

  return y + 2;
};

const normalizeDomainName = (key) => {
  if (!key) return "";
  if (DOMAIN_ALIAS[key]) return DOMAIN_ALIAS[key];
  return key;
};

const normalizeDomainEntries = (result) => {
  if (!result || typeof result !== "object") return [];

  const candidates = [];

  if (result.domain_scores && typeof result.domain_scores === "object") {
    Object.entries(result.domain_scores).forEach(([key, value]) => {
      candidates.push({
        name: normalizeDomainName(key),
        score: safeNumber(value),
        raw: value
      });
    });
  }

  if (Array.isArray(result.domain_stats)) {
    result.domain_stats.forEach((item) => {
      candidates.push({
        name: normalizeDomainName(item?.domain || item?.name || item?.label),
        score: safeNumber(item?.score ?? item?.value),
        raw: item?.score ?? item?.value
      });
    });
  }

  if (Array.isArray(result.dimensions)) {
    result.dimensions.forEach((item) => {
      candidates.push({
        name: normalizeDomainName(item?.name || item?.domain || item?.label),
        score: safeNumber(item?.score ?? item?.value),
        raw: item?.score ?? item?.value
      });
    });
  }

  const seen = new Map();
  candidates.forEach((item) => {
    if (!item.name) return;
    if (!seen.has(item.name)) {
      seen.set(item.name, item);
    }
  });

  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
};

const getPriorityDomains = (result, suggestion) => {
  if (Array.isArray(suggestion?.priority_domains) && suggestion.priority_domains.length) {
    return suggestion.priority_domains.slice(0, 4);
  }
  const entries = normalizeDomainEntries(result);
  return entries.slice(0, 3).map((item) => item.name);
};

const buildOverviewInsights = ({ overview, gradeStats, classStats }) => {
  const insights = [];

  const completionRate = safePercent(overview?.completion?.rate);
  insights.push(`本次测评覆盖学生 ${overview?.completion?.finished || 0} 人，覆盖率为 ${completionRate}。`);

  const gradeRiskList = (gradeStats || []).map((item) => ({
    grade: item.grade,
    highCount: Number(item?.risk_dist?.R3 || 0),
    warnCount: Number(item?.risk_dist?.R2 || 0) + Number(item?.risk_dist?.R3 || 0),
    total: Number(item?.finished_students || item?.total_students || 0)
  }));

  const topGrade = [...gradeRiskList].sort((a, b) => b.warnCount - a.warnCount)[0];
  if (topGrade) {
    insights.push(`${topGrade.grade}年级预警学生（R2+R3）共 ${topGrade.warnCount} 人，为当前重点关注年级。`);
  }

  const topClass = [...(classStats || [])]
    .map((item) => ({
      class_no: item.class_no,
      highCount: Number(item?.risk_dist?.R3 || 0),
      warnCount: Number(item?.risk_dist?.R2 || 0) + Number(item?.risk_dist?.R3 || 0)
    }))
    .sort((a, b) => b.warnCount - a.warnCount)[0];

  if (topClass) {
    insights.push(`${topClass.class_no}班预警人数（R2+R3）为 ${topClass.warnCount} 人，建议班主任与心理老师协同跟进。`);
  }

  const domainAvgEntries = Object.entries(overview?.domain_avg || {}).map(([key, value]) => ({
    name: key,
    value: safeNumber(value)
  }));
  const topDomain = domainAvgEntries.sort((a, b) => b.value - a.value)[0];
  if (topDomain) {
    insights.push(`当前全校均值较高的心理维度为“${topDomain.name}”，建议结合年级特点开展专题支持。`);
  }

  return insights;
};

const drawCoverPage = (pdf, reportData, pageNoRef) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const schoolName = reportData.schoolName || "XX学校";

  // 页面背景
  pdf.setFillColor(...PDF_THEME.colors.brand.primarySoft);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // 顶部标题区域
  pdf.setFillColor(...PDF_THEME.colors.brand.primary);
  pdf.rect(0, 0, pageWidth, 50, "F");

  // 报告标题（最上方，大字体）
  setPdfFont(pdf, "bold", 30);
  pdf.setTextColor(...PDF_THEME.colors.text.inverse);
  pdf.text("学校心理测评统计分析报告", pageWidth / 2, 28, {
    align: "center"
  });

  // 副标题
  setPdfFont(pdf, "normal", 12);
  pdf.text("School Psychological Assessment Report", pageWidth / 2, 40, {
    align: "center"
  });

  // 信息卡片
  pdf.setFillColor(...PDF_THEME.colors.surface.page);
  pdf.setDrawColor(...PDF_THEME.colors.line.light);
  pdf.roundedRect(22, 90, pageWidth - 44, 100, 3, 3, "FD");

  const baseX = 36;
  let y = 110;

  setPdfFont(pdf, "bold", 13);
  pdf.setTextColor(...PDF_THEME.colors.text.title);
  pdf.text("报告信息", baseX, y);

  y += 14;

  setPdfFont(pdf, "normal", 11);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);

  pdf.text(`学校名称：${schoolName}`, baseX, y);
  y += 12;

  pdf.text(`报告名称：${REPORT_TITLE}`, baseX, y);
  y += 12;

  pdf.text(`生成时间：${formatDateTime(reportData.generatedAt)}`, baseX, y);
  y += 12;

  pdf.text(`统计范围：${reportData?.overview?.completion?.total_students || 0} 名学生`, baseX, y);
  y += 12;

  pdf.text(`测评完成：${reportData?.overview?.completion?.finished || 0} 人`, baseX, y);

  // 底部说明
  pdf.setDrawColor(...PDF_THEME.colors.line.normal);
  pdf.line(22, 200, pageWidth - 22, 200);

  setPdfFont(pdf, "bold", 11);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text("统计说明", 22, 212);

  setPdfFont(pdf, "normal", 9.5);
  pdf.setTextColor(...PDF_THEME.colors.text.secondary);

  const notes = [
    "1. 本报告用于学校心理健康筛查与教育管理参考。",
    "2. 风险等级分为 R0、R1、R2、R3 四个等级。",
    "3. 本报告仅用于教育管理参考，不作为医学诊断。",
    "4. 涉及学生个体信息内容仅限校内授权人员查阅。"
  ];

  let noteY = 222;
  notes.forEach((item) => {
    pdf.text(item, 22, noteY);
    noteY += 8;
  });

  setPdfFont(pdf, "normal", 9);
  pdf.setTextColor(...PDF_THEME.colors.text.light);
  pdf.text("内部资料，请注意保密", pageWidth / 2, pageHeight - 16, {
    align: "center"
  });

  pageNoRef.current = 1;
};

const drawOverviewPage = (pdf, reportData, pageNoRef) => {
  const schoolName = reportData.schoolName;
  let y = addNewPage(pdf, pageNoRef, schoolName);

  const overview = reportData.overview || {};
  const completion = overview.completion || {};
  const total = Number(completion.total_students || 0);
  const finished = Number(completion.finished || 0);
  const unfinished = total - finished;
  const completionRate = safePercent(completion.rate);

  y = drawSectionTitle(pdf, "一、全校总体概览", y, pageNoRef, schoolName, "Overall School Overview");

  const startX = PDF_THEME.page.marginX;
  const cardGap = 4;
  const cardWidth = (PDF_THEME.page.contentWidth - cardGap * 3) / 4;

  drawStatCard(
    pdf,
    {
      x: startX,
      width: cardWidth,
      title: "总学生数",
      value: `${total}`,
      subValue: "全校"
    },
    y,
    pageNoRef,
    schoolName
  );

  drawStatCard(
    pdf,
    {
      x: startX + (cardWidth + cardGap) * 1,
      width: cardWidth,
      title: "已完成测评",
      value: `${finished}`,
      subValue: "已测"
    },
    y,
    pageNoRef,
    schoolName
  );

  drawStatCard(
    pdf,
    {
      x: startX + (cardWidth + cardGap) * 2,
      width: cardWidth,
      title: "未完成测评",
      value: `${unfinished}`,
      subValue: "待补测"
    },
    y,
    pageNoRef,
    schoolName
  );

  drawStatCard(
    pdf,
    {
      x: startX + (cardWidth + cardGap) * 3,
      width: cardWidth,
      title: "测评完成率",
      value: completionRate,
      subValue: "完成情况"
    },
    y,
    pageNoRef,
    schoolName
  );

  y += 32;
  y = drawRiskDistributionBar(pdf, overview.risk_dist, y, pageNoRef, schoolName, "全校风险等级分布");
  y += 4;
  y = drawDomainAverageBars(pdf, overview.domain_avg, y, pageNoRef, schoolName);

  const insights = buildOverviewInsights(reportData);
  y += 2;
  y = drawBulletList(pdf, "关键结论", insights, y, pageNoRef, schoolName);

  y = drawInfoBox(
    pdf,
    "管理提示",
    "建议优先关注 R2、R3 学生群体，结合年级和班级分布安排复核访谈、班主任联动观察、重点班级团体辅导与家校协同沟通。",
    y,
    pageNoRef,
    schoolName
  );

  return y;
};

const buildGradeTableRows = (gradeStats = []) => {
  return gradeStats.map((item) => {
    const r0 = Number(item?.risk_dist?.R0 || 0);
    const r1 = Number(item?.risk_dist?.R1 || 0);
    const r2 = Number(item?.risk_dist?.R2 || 0);
    const r3 = Number(item?.risk_dist?.R3 || 0);
    const finished = Number(item?.finished_students || 0);

    const avgRiskScore = finished > 0 ? ((r1 * 0.35 + r2 * 0.6 + r3 * 0.82) / finished).toFixed(2) : "0.00";

    return {
      grade: `${item.grade}年级`,
      total_students: item.total_students,
      finished_students: item.finished_students,
      completion_rate: safePercent(item.completion_rate),
      r0,
      r1,
      r2,
      r3,
      avg_risk_score: avgRiskScore
    };
  });
};

const drawGradeAnalysisPage = (pdf, reportData, pageNoRef) => {
  const schoolName = reportData.schoolName;
  let y = addNewPage(pdf, pageNoRef, schoolName);

  y = drawSectionTitle(pdf, "二、年级统计分析", y, pageNoRef, schoolName, "Grade Level Analysis");

  const gradeRows = buildGradeTableRows(reportData.gradeStats || []);
  const columns = [
    { title: "年级", dataIndex: "grade", width: 20, align: "center" },
    { title: "总人数", dataIndex: "total_students", width: 18, align: "center" },
    { title: "已测评", dataIndex: "finished_students", width: 20, align: "center" },
    { title: "完成率", dataIndex: "completion_rate", width: 22, align: "center" },
    { title: "R0", dataIndex: "r0", width: 15, align: "center" },
    { title: "R1", dataIndex: "r1", width: 15, align: "center" },
    { title: "R2", dataIndex: "r2", width: 15, align: "center" },
    { title: "R3", dataIndex: "r3", width: 15, align: "center" },
    { title: "平均风险分", dataIndex: "avg_risk_score", width: 25, align: "center" }
  ];

  y = drawSimpleTable(pdf, columns, gradeRows, y, pageNoRef, schoolName);

  const gradeSummary = [...(reportData.gradeStats || [])]
    .map((item) => {
      const warnCount = Number(item?.risk_dist?.R2 || 0) + Number(item?.risk_dist?.R3 || 0);
      return {
        grade: item.grade,
        warnCount,
        highCount: Number(item?.risk_dist?.R3 || 0)
      };
    })
    .sort((a, b) => b.warnCount - a.warnCount);

  const bullets = [];
  if (gradeSummary[0]) {
    bullets.push(`${gradeSummary[0].grade}年级预警人数（R2+R3）最高，共 ${gradeSummary[0].warnCount} 人。`);
  }
  if (gradeSummary[1]) {
    bullets.push(`${gradeSummary[1].grade}年级预警人数位列第二，共 ${gradeSummary[1].warnCount} 人。`);
  }
  bullets.push("建议按年级安排心理教育活动，对预警人数较高年级进行专项干预部署。");

  y = drawBulletList(pdf, "年级分析结论", bullets, y + 2, pageNoRef, schoolName);
};

const buildClassTableRows = (classStats = []) => {
  return classStats.map((item) => {
    const r0 = Number(item?.risk_dist?.R0 || 0);
    const r1 = Number(item?.risk_dist?.R1 || 0);
    const r2 = Number(item?.risk_dist?.R2 || 0);
    const r3 = Number(item?.risk_dist?.R3 || 0);
    const warning = r2 + r3;
    const finished = Number(item?.finished_students || 0);
    const avgRiskScore = finished > 0 ? ((r1 * 0.35 + r2 * 0.6 + r3 * 0.82) / finished).toFixed(2) : "0.00";

    return {
      class_no: `${item.class_no}班`,
      total_students: item.total_students,
      finished_students: item.finished_students,
      completion_rate: safePercent(item.completion_rate),
      r0,
      r1,
      r2,
      r3,
      avg_risk_score: avgRiskScore,
      warning_count: warning
    };
  });
};

const drawClassAnalysisPage = (pdf, reportData, pageNoRef) => {
  const schoolName = reportData.schoolName;
  let y = addNewPage(pdf, pageNoRef, schoolName);

  y = drawSectionTitle(pdf, "三、班级统计分析", y, pageNoRef, schoolName, "Class Level Analysis");

  const classRows = buildClassTableRows(reportData.classStats || []).sort((a, b) => b.warning_count - a.warning_count);

  const columns = [
    { title: "班级", dataIndex: "class_no", width: 18, align: "center" },
    { title: "总人数", dataIndex: "total_students", width: 16, align: "center" },
    { title: "已测评", dataIndex: "finished_students", width: 18, align: "center" },
    { title: "完成率", dataIndex: "completion_rate", width: 20, align: "center" },
    { title: "R0", dataIndex: "r0", width: 13, align: "center" },
    { title: "R1", dataIndex: "r1", width: 13, align: "center" },
    { title: "R2", dataIndex: "r2", width: 13, align: "center" },
    { title: "R3", dataIndex: "r3", width: 13, align: "center" },
    { title: "预警人数", dataIndex: "warning_count", width: 22, align: "center" },
    { title: "平均风险分", dataIndex: "avg_risk_score", width: 24, align: "center" }
  ];

  y = drawSimpleTable(pdf, columns, classRows, y, pageNoRef, schoolName);

  const topClasses = classRows.slice(0, 3);
  const bullets = topClasses.map(
    (item, index) => `第 ${index + 1} 位：${item.class_no}，预警人数 ${item.warning_count} 人。`
  );
  bullets.push("建议对预警人数较高班级开展班级团辅，并建立班主任—心理老师协同观察机制。");

  y = drawBulletList(pdf, "重点班级提示", bullets, y + 2, pageNoRef, schoolName);
};

const buildWarningStudents = (students = [], detailMap = {}) => {
  return [...students]
    .filter((item) => item.has_test && ["R2", "R3"].includes(item.risk_level))
    .map((item) => {
      const detail = detailMap[item.id] || {};
      const priorityDomains = getPriorityDomains(detail.result, detail.suggestion).join("、") || "-";

      return {
        id: item.id,
        real_name: item.real_name,
        grade: `${item.grade}年级`,
        class_no: `${item.class_no}班`,
        risk_level: RISK_TEXT_MAP[item.risk_level] || item.risk_level,
        risk_score: safeNumber(item.risk_score).toFixed(4),
        priority_domains: priorityDomains,
        finished_at: formatDateTime(item.finished_at)
      };
    })
    .sort((a, b) => Number(b.risk_score) - Number(a.risk_score));
};

const drawWarningStudentsPage = (pdf, reportData, pageNoRef) => {
  const schoolName = reportData.schoolName;
  let y = addNewPage(pdf, pageNoRef, schoolName);

  y = drawSectionTitle(pdf, "四、重点学生预警摘要", y, pageNoRef, schoolName, "Warning Students Summary");

  y = drawInfoBox(
    pdf,
    "查阅说明",
    "本页仅展示中高风险与高风险学生摘要，用于校领导、心理老师和德育管理人员查看。学生个体信息属于敏感教育管理资料，请严格控制查阅范围。",
    y,
    pageNoRef,
    schoolName,
    {
      fillColor: PDF_THEME.colors.alert.fill,
      borderColor: PDF_THEME.colors.alert.border
    }
  );

  const rows = buildWarningStudents(reportData.students, reportData.studentDetailMap).map((item, index) => ({
    index: index + 1,
    real_name: item.real_name,
    grade: item.grade,
    class_no: item.class_no,
    risk_level: item.risk_level,
    risk_score: item.risk_score,
    priority_domains: item.priority_domains,
    finished_at: item.finished_at
  }));

  const columns = [
    { title: "序号", dataIndex: "index", width: 12, align: "center" },
    { title: "姓名", dataIndex: "real_name", width: 20, align: "center" },
    { title: "年级", dataIndex: "grade", width: 18, align: "center" },
    { title: "班级", dataIndex: "class_no", width: 18, align: "center" },
    { title: "风险等级", dataIndex: "risk_level", width: 20, align: "center" },
    { title: "风险分", dataIndex: "risk_score", width: 18, align: "center" },
    { title: "主要预警维度", dataIndex: "priority_domains", width: 42, align: "left" },
    { title: "测评时间", dataIndex: "finished_at", width: 32, align: "center" }
  ];

  y = drawSimpleTable(pdf, columns, rows, y, pageNoRef, schoolName, {
    fontSize: 8.2,
    rowMinHeight: 8
  });

  const r3Count = reportData.students.filter((s) => s.has_test && s.risk_level === "R3").length;
  const r2Count = reportData.students.filter((s) => s.has_test && s.risk_level === "R2").length;

  y = drawBulletList(
    pdf,
    "重点管理建议",
    [
      `当前高风险（R3）学生共 ${r3Count} 人，建议优先安排人工复核与访谈跟进。`,
      `当前中高风险（R2）学生共 ${r2Count} 人，建议纳入近期动态观察名单。`,
      "建议建立重点学生台账，明确责任人、跟进节点与复评周期。"
    ],
    y + 2,
    pageNoRef,
    schoolName
  );
};

const drawManagementSuggestionPage = (pdf, reportData, pageNoRef) => {
  const schoolName = reportData.schoolName;
  let y = addNewPage(pdf, pageNoRef, schoolName);

  y = drawSectionTitle(pdf, "五、学校管理建议", y, pageNoRef, schoolName, "Management Recommendations");

  y = drawInfoBox(
    pdf,
    "学校层面",
    "建议建立心理测评结果动态跟踪机制，对 R2、R3 学生形成台账管理；对测评完成率不足的情况及时组织补测；按学期形成连续性数据留档，支持纵向比较与干预效果评估。",
    y,
    pageNoRef,
    schoolName,
    {
      fillColor: PDF_THEME.colors.section.teacherBg,
      borderColor: PDF_THEME.colors.section.teacherBorder
    }
  );

  y = drawInfoBox(
    pdf,
    "年级与班级层面",
    "对预警人数较高年级开展主题心理讲座或专题团辅；对重点班级加强班主任日常观察与心理委员反馈；将学习压力、焦虑、人际适应等问题与阶段性教学安排联动分析。",
    y,
    pageNoRef,
    schoolName,
    {
      fillColor: PDF_THEME.colors.section.studentBg,
      borderColor: PDF_THEME.colors.section.studentBorder
    }
  );

  y = drawInfoBox(
    pdf,
    "个体跟进层面",
    "对高风险学生建议开展一对一复核访谈，必要时结合家校沟通与专业转介；对中高风险学生建议设置复评周期，结合课堂表现、行为变化和同伴互动情况进行动态观察。",
    y,
    pageNoRef,
    schoolName,
    {
      fillColor: PDF_THEME.colors.section.parentBg,
      borderColor: PDF_THEME.colors.section.parentBorder
    }
  );

  y = drawBulletList(
    pdf,
    "建议动作清单",
    [
      "建立重点学生周跟进机制。",
      "建立班级心理风险月度复盘机制。",
      "对重点年级开展团体辅导活动。",
      "完善补测与复评流程，形成闭环管理。"
    ],
    y,
    pageNoRef,
    schoolName
  );
};

const drawStudentAppendixHeader = (pdf, student, y) => {
  const x = PDF_THEME.page.marginX;
  const width = PDF_THEME.page.contentWidth;
  const riskStyle = getRiskStyle(student?.risk_level);

  pdf.setFillColor(...PDF_THEME.colors.brand.primarySoft);
  pdf.setDrawColor(...PDF_THEME.colors.line.light);
  pdf.roundedRect(x, y, width, 18, PDF_THEME.radius.md, PDF_THEME.radius.md, "FD");

  setPdfFont(pdf, "bold", 12);
  pdf.setTextColor(...PDF_THEME.colors.text.title);
  pdf.text(`${student?.real_name || "-"}｜${student?.grade}年级 ${student?.class_no}班`, x + 5, y + 7);

  drawBadge(pdf, riskStyle.label, x + width - 30, y + 4.5, {
    fillColor: riskStyle.fillColor,
    borderColor: riskStyle.borderColor,
    textColor: riskStyle.textColor
  });

  setPdfFont(pdf, "normal", 9.2);
  pdf.setTextColor(...PDF_THEME.colors.text.secondary);
  pdf.text(`测评时间：${formatDateTime(student?.finished_at)}`, x + 5, y + 14);

  return y + 22;
};

const drawStudentBasicGrid = (pdf, student, result, y, pageNoRef, schoolName) => {
  const rows = [
    {
      label1: "姓名",
      value1: student?.real_name || "-",
      label2: "学校",
      value2: student?.school_name || "-"
    },
    {
      label1: "年级",
      value1: `${student?.grade || "-"}年级`,
      label2: "班级",
      value2: `${student?.class_no || "-"}班`
    },
    {
      label1: "风险等级",
      value1: RISK_TEXT_MAP[student?.risk_level] || student?.risk_level || "-",
      label2: "风险评分",
      value2: safeNumber(student?.risk_score).toFixed(4)
    },
    {
      label1: "测评状态",
      value1: student?.has_test ? "已完成" : "未完成",
      label2: "结果时间",
      value2: formatDateTime(result?.finished_at || result?.created_at || student?.finished_at)
    }
  ];

  const x = PDF_THEME.page.marginX;
  const width = PDF_THEME.page.contentWidth;
  const rowHeight = 10;

  y = ensurePageSpace(pdf, y, rows.length * rowHeight + 4, pageNoRef, schoolName);

  rows.forEach((row, idx) => {
    const currentY = y + idx * rowHeight;

    pdf.setDrawColor(...PDF_THEME.colors.line.light);
    pdf.rect(x, currentY, width, rowHeight);

    pdf.line(x + 45, currentY, x + 45, currentY + rowHeight);
    pdf.line(x + 90, currentY, x + 90, currentY + rowHeight);
    pdf.line(x + 135, currentY, x + 135, currentY + rowHeight);

    setPdfFont(pdf, "bold", 9.2);
    pdf.setTextColor(...PDF_THEME.colors.text.primary);
    pdf.text(row.label1, x + 3, currentY + 6.3);
    pdf.text(row.label2, x + 93, currentY + 6.3);

    setPdfFont(pdf, "normal", 9.2);
    pdf.setTextColor(...PDF_THEME.colors.text.secondary);
    pdf.text(String(row.value1), x + 48, currentY + 6.3);
    pdf.text(String(row.value2), x + 138, currentY + 6.3);
  });

  return y + rows.length * rowHeight + 4;
};

const drawStudentDomainTable = (pdf, result, y, pageNoRef, schoolName) => {
  const entries = normalizeDomainEntries(result);

  if (!entries.length) {
    return drawParagraph(pdf, "暂无维度统计数据。", y, pageNoRef, schoolName, {
      fontSize: 9.5,
      color: PDF_THEME.colors.text.secondary
    });
  }

  const rows = entries.map((item) => ({
    domain: item.name,
    score: safeNumber(item.score).toFixed(2),
    status:
      item.score >= 0.75 ? "重点关注" : item.score >= 0.55 ? "需关注" : item.score >= 0.35 ? "轻度波动" : "相对稳定"
  }));

  const columns = [
    { title: "维度", dataIndex: "domain", width: 58, align: "left" },
    { title: "得分", dataIndex: "score", width: 28, align: "center" },
    { title: "状态", dataIndex: "status", width: 32, align: "center" }
  ];

  return drawSimpleTable(pdf, columns, rows, y, pageNoRef, schoolName, {
    width: 118,
    rowMinHeight: 8.5,
    fontSize: 8.8
  });
};

const drawTagGroup = (pdf, title, tags, y, pageNoRef, schoolName, options = {}) => {
  const {
    x = PDF_THEME.page.marginX,
    width = PDF_THEME.page.contentWidth,
    titleFontSize = PDF_THEME.fontSize.bodySmall,
    tagHeight = 7,
    gapX = 3,
    gapY = 3,
    fillColor = PDF_THEME.colors.surface.muted,
    borderColor = PDF_THEME.colors.line.light,
    textColor = PDF_THEME.colors.text.secondary
  } = options;

  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (!list.length) return y;

  y = ensurePageSpace(pdf, y, 18, pageNoRef, schoolName);

  setPdfFont(pdf, "bold", titleFontSize);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text(String(title), x, y);

  let cursorX = x;
  let cursorY = y + 5;

  for (const tag of list) {
    setPdfFont(pdf, "normal", PDF_THEME.fontSize.caption);
    const tagWidth = pdf.getTextWidth(String(tag)) + 8;

    if (cursorX + tagWidth > x + width) {
      cursorX = x;
      cursorY += tagHeight + gapY;
    }

    cursorY = ensurePageSpace(pdf, cursorY, tagHeight + 2, pageNoRef, schoolName);

    pdf.setFillColor(...fillColor);
    pdf.setDrawColor(...borderColor);
    pdf.roundedRect(cursorX, cursorY, tagWidth, tagHeight, PDF_THEME.radius.md, PDF_THEME.radius.md, "FD");

    pdf.setTextColor(...textColor);
    setPdfFont(pdf, "normal", PDF_THEME.fontSize.caption);
    pdf.text(String(tag), cursorX + 4, cursorY + 4.8);

    cursorX += tagWidth + gapX;
  }

  return cursorY + tagHeight + 4;
};

const drawAdviceCard = (pdf, config, y, pageNoRef, schoolName) => {
  const {
    title = "",
    items = [],
    fillColor = PDF_THEME.colors.surface.card,
    borderColor = PDF_THEME.colors.line.light,
    titleColor = PDF_THEME.colors.text.title,
    textColor = PDF_THEME.colors.text.primary
  } = config;

  const x = PDF_THEME.page.marginX;
  const width = PDF_THEME.page.contentWidth;
  const list = Array.isArray(items) ? items.filter(Boolean) : [];

  setPdfFont(pdf, "bold", PDF_THEME.fontSize.cardTitle);
  const titleLines = pdf.splitTextToSize(title, width - 12);

  setPdfFont(pdf, "normal", PDF_THEME.fontSize.bodySmall);
  let contentLines = [];
  list.forEach((item) => {
    const lines = pdf.splitTextToSize(`• ${item}`, width - 12);
    contentLines.push(...lines, "");
  });

  if (contentLines[contentLines.length - 1] === "") {
    contentLines.pop();
  }

  const titleHeight = titleLines.length * PDF_THEME.lineHeight.title;
  const lineHeight = PDF_THEME.lineHeight.tight;
  const contentHeight = Math.max(contentLines.length * lineHeight, 8);
  const cardHeight = 6 + titleHeight + 3 + contentHeight + 6;

  y = ensurePageSpace(pdf, y, cardHeight + 2, pageNoRef, schoolName);

  pdf.setFillColor(...fillColor);
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(x, y, width, cardHeight, PDF_THEME.radius.md, PDF_THEME.radius.md, "FD");

  pdf.setFillColor(...borderColor);
  pdf.rect(x, y, 2.2, cardHeight, "F");

  setPdfFont(pdf, "bold", PDF_THEME.fontSize.cardTitle);
  pdf.setTextColor(...titleColor);
  titleLines.forEach((line, idx) => {
    pdf.text(String(line), x + 6, y + 7 + idx * PDF_THEME.lineHeight.title);
  });

  setPdfFont(pdf, "normal", PDF_THEME.fontSize.bodySmall);
  pdf.setTextColor(...textColor);
  const textStartY = y + 6 + titleHeight + 3;

  contentLines.forEach((line, idx) => {
    pdf.text(String(line), x + 6, textStartY + idx * lineHeight);
  });

  return y + cardHeight + PDF_THEME.spacing.sm;
};

const drawSingleStudentAppendixPage = (pdf, student, detail, pageNoRef, schoolName) => {
  let y = addNewPage(pdf, pageNoRef, schoolName);

  y = drawSectionTitle(pdf, "六、学生测评结果附录", y, pageNoRef, schoolName, "Student Individual Appendix");

  y = drawStudentAppendixHeader(pdf, student, y);

  const result = detail?.result || {};
  const suggestion = detail?.suggestion || {};

  y = drawStudentBasicGrid(pdf, student, result, y, pageNoRef, schoolName);

  setPdfFont(pdf, "bold", 11);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text("综合结论", PDF_THEME.page.marginX, y);
  y += 6;

  const summaryText =
    suggestion?.summary_content ||
    result?.summary ||
    "暂无自动分析摘要，建议结合测评维度分布及学生日常表现进行综合判断。";

  y = drawParagraph(pdf, summaryText, y, pageNoRef, schoolName, {
    fontSize: 9.6,
    lineHeight: 5.1,
    color: PDF_THEME.colors.text.secondary
  });

  y += 2;
  y = drawTagGroup(pdf, "重点关注维度", getPriorityDomains(result, suggestion), y, pageNoRef, schoolName, {
    fillColor: PDF_THEME.colors.surface.muted,
    borderColor: PDF_THEME.colors.line.light,
    textColor: PDF_THEME.colors.text.secondary
  });

  y += 2;
  setPdfFont(pdf, "bold", 11);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text("维度统计", PDF_THEME.page.marginX, y);
  y += 5;

  const leftTableY = y;
  const rightBoxX = 138;

  const tableEndY = drawStudentDomainTable(pdf, result, y, pageNoRef, schoolName);

  const followupText = [
    `建议动作：${
      Array.isArray(suggestion?.actions) && suggestion.actions.length ? suggestion.actions.join("、") : "持续观察"
    }`,
    `复评周期：${suggestion?.followup_days ? `${suggestion.followup_days} 天内` : "建议 2-4 周内复核"}`,
    `人工复核：${suggestion?.refer_required ? "建议尽快人工复核/转介" : "可由班主任与心理老师联合观察"}`
  ].join("\n");

  const boxHeight = 44;
  const boxY = leftTableY;
  pdf.setFillColor(...PDF_THEME.colors.surface.card);
  pdf.setDrawColor(...PDF_THEME.colors.line.light);
  pdf.roundedRect(rightBoxX, boxY, 57, boxHeight, PDF_THEME.radius.md, PDF_THEME.radius.md, "FD");

  setPdfFont(pdf, "bold", 10);
  pdf.setTextColor(...PDF_THEME.colors.text.primary);
  pdf.text("跟进建议", rightBoxX + 4, boxY + 7);

  setPdfFont(pdf, "normal", 8.7);
  pdf.setTextColor(...PDF_THEME.colors.text.secondary);
  const followLines = pdf.splitTextToSize(followupText, 49);
  followLines.forEach((line, idx) => {
    pdf.text(String(line), rightBoxX + 4, boxY + 14 + idx * 4.5);
  });

  y = Math.max(tableEndY, boxY + boxHeight + 4);

  y = drawAdviceCard(
    pdf,
    {
      title: "给学生的建议",
      items: suggestion?.student_advice?.length
        ? suggestion.student_advice
        : ["保持规律作息，觉察情绪变化，遇到困扰及时向老师或家长求助。"],
      fillColor: PDF_THEME.colors.section.studentBg,
      borderColor: PDF_THEME.colors.section.studentBorder,
      titleColor: PDF_THEME.colors.section.studentTitle
    },
    y,
    pageNoRef,
    schoolName
  );

  y = drawAdviceCard(
    pdf,
    {
      title: "给教师的建议",
      items: suggestion?.teacher_advice?.length
        ? suggestion.teacher_advice
        : ["关注课堂状态、同伴互动与行为变化，必要时安排个别谈话并记录观察情况。"],
      fillColor: PDF_THEME.colors.section.teacherBg,
      borderColor: PDF_THEME.colors.section.teacherBorder,
      titleColor: PDF_THEME.colors.section.teacherTitle
    },
    y,
    pageNoRef,
    schoolName
  );

  y = drawAdviceCard(
    pdf,
    {
      title: "给家长的建议",
      items: suggestion?.parent_advice?.length
        ? suggestion.parent_advice
        : ["保持稳定沟通氛围，减少简单批评，关注作息、压力和情绪表达变化。"],
      fillColor: PDF_THEME.colors.section.parentBg,
      borderColor: PDF_THEME.colors.section.parentBorder,
      titleColor: PDF_THEME.colors.section.parentTitle
    },
    y,
    pageNoRef,
    schoolName
  );
};

const buildFileName = (reportData) => {
  const schoolName = reportData.schoolName || "学校";
  return `${schoolName}_心理测评统计分析报告_${formatDateTimeFile(reportData.generatedAt)}.pdf`;
};

export const exportTeacherStatisticReport = async (reportData) => {
  try {
    const pdf = new jsPDF("p", "mm", "a4");
    registerPdfFonts(pdf);

    const pageNoRef = { current: 1 };

    drawCoverPage(pdf, reportData, pageNoRef);
    drawOverviewPage(pdf, reportData, pageNoRef);
    drawGradeAnalysisPage(pdf, reportData, pageNoRef);
    drawClassAnalysisPage(pdf, reportData, pageNoRef);
    drawWarningStudentsPage(pdf, reportData, pageNoRef);
    drawManagementSuggestionPage(pdf, reportData, pageNoRef);

    const studentList = [...(reportData.students || [])]
      .filter((item) => item.has_test)
      .sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        if (a.class_no !== b.class_no) return a.class_no - b.class_no;
        return String(a.real_name || "").localeCompare(String(b.real_name || ""), "zh-CN");
      });

    studentList.forEach((student) => {
      drawSingleStudentAppendixPage(
        pdf,
        student,
        reportData.studentDetailMap?.[student.id] || {},
        pageNoRef,
        reportData.schoolName
      );
    });

    pdf.save(buildFileName(reportData));
    message.success("教师端统计报告导出成功");
  } catch (error) {
    console.error("导出教师端统计报告失败:", error);
    message.error("教师端统计报告导出失败，请稍后重试");
    throw error;
  }
};
