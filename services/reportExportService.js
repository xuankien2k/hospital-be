const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { HOSPITAL_PROFILE } = require('../constants/hospital');
const { buildMatrixGrouped } = require('../utils/reportMetrics');
const {
  applyMatrixRowHighlighting,
  getBelowPlanMatrixCodes,
} = require('../utils/docxMatrixHighlight');
const { applyTableColumnWidths } = require('../utils/docxTableWidthFix');
const { applyReportTypography } = require('../utils/docxReportTypography');

const TEMPLATE_PATH = path.join(__dirname, '../templates/bao-cao-ctcl.template.docx');

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toFixed(digits);
}

function formatPercent(part, total) {
  if (!total) return '0';
  return formatNumber((part / total) * 100, 2);
}

function buildExportPayload(report) {
  const { summary } = report;
  const byLevel = summary?.byLevel || {};
  const totalApplied = summary?.totalApplied || 0;
  const excludedCodesText = (summary?.excludedCodes || []).join(', ') || 'C4.5, C4.6, C5.1';
  const planYear = HOSPITAL_PROFILE.planYear || new Date().getFullYear();

  const byPart = (summary?.byPart || []).map((p) => ({
    partLabel: `${p.part}. ${p.label}`,
    count: String(p.count),
    avgScore: formatNumber(p.avgScore),
  }));

  const byDepartment = (summary?.byDepartment || []).map((d) => ({
    rank: String(d.rank),
    name: d.name,
    count: String(d.count),
    avgScore: formatNumber(d.avgScore),
  }));

  const belowLevel3 = (report.belowLevel3 || []).map((row, index) => ({
    stt: String(index + 1),
    code: row.code,
    name: row.name,
    currentLevel: String(row.currentLevel),
    expectedLevel: String(row.expectedLevel ?? ''),
    departmentName: row.departmentName,
  }));

  const notAchieved = (report.notAchievedCriteria || []).map((row, index) => ({
    stt: String(index + 1),
    code: row.code,
    name: row.name,
    currentLevel: String(row.currentLevel),
    expectedLevel: String(row.expectedLevel ?? ''),
    departmentName: row.departmentName,
  }));

  const matrixGrouped = buildMatrixGrouped(report.matrix || []);
  const matrix = matrixGrouped.map((row) => ({
    code: row.code,
    name: row.name,
    currentLevel: row.currentLevel,
    expectedLevel: row.expectedLevel,
    departmentName: row.departmentName,
  }));
  const matrixBelowPlanCodes = getBelowPlanMatrixCodes(matrixGrouped);

  const now = new Date();
  const reportDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  return {
    reportTitle: HOSPITAL_PROFILE.reportTitle,
    hospitalName: HOSPITAL_PROFILE.hospitalName,
    address: HOSPITAL_PROFILE.address,
    managingAgency: HOSPITAL_PROFILE.managingAgency,
    hospitalRank: HOSPITAL_PROFILE.hospitalRank,
    hospitalType: HOSPITAL_PROFILE.hospitalType,
    reportDate,
    planYear: String(planYear),
    totalApplied: String(totalApplied),
    totalStandard: String(summary?.totalStandard || 83),
    excludedCodesText,
    appliedPercent: formatNumber(summary?.appliedPercent || 0, 0),
    totalWeightedScore: String(summary?.totalWeightedScore || 0),
    totalWeight: String(summary?.totalWeight || 0),
    overallScore: formatNumber(summary?.overallScore || 0),
    level1: String(byLevel.level1 || 0),
    level2: String(byLevel.level2 || 0),
    level3: String(byLevel.level3 || 0),
    level4: String(byLevel.level4 || 0),
    level5: String(byLevel.level5 || 0),
    level1Percent: formatPercent(byLevel.level1 || 0, totalApplied),
    level2Percent: formatPercent(byLevel.level2 || 0, totalApplied),
    level3Percent: formatPercent(byLevel.level3 || 0, totalApplied),
    level4Percent: formatPercent(byLevel.level4 || 0, totalApplied),
    level5Percent: formatPercent(byLevel.level5 || 0, totalApplied),
    byPart,
    byDepartment,
    belowLevel3,
    notAchieved,
    matrix,
    matrixBelowPlanCodes,
  };
}

function exportReportDocx(report) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      'Chưa có file template Word. Chạy: node scripts/generate-report-template.js',
    );
  }

  const content = fs.readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });

  const payload = buildExportPayload(report);
  doc.render(payload);

  let buffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  buffer = applyMatrixRowHighlighting(buffer, payload.matrixBelowPlanCodes);
  buffer = applyTableColumnWidths(buffer);
  buffer = applyReportTypography(buffer);

  return buffer;
}

module.exports = { buildExportPayload, exportReportDocx, TEMPLATE_PATH };
