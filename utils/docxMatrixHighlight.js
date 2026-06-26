const BELOW_PLAN_FILL = 'FFF1F0';
const BELOW_PLAN_TEXT = 'CF1322';
const MATRIX_TABLE_COLUMN_COUNT = 5;
const MATRIX_SCORE_COLUMN_INDEXES = [2, 3];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRowPlainText(trXml) {
  const parts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = re.exec(trXml)) !== null) {
    parts.push(match[1]);
  }
  return parts.join('');
}

function rowMatchesCode(trXml, code) {
  if (new RegExp(`<w:t[^>]*>${escapeRegex(code)}<\\/w:t>`).test(trXml)) {
    return true;
  }
  const texts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = re.exec(trXml)) !== null) {
    texts.push(match[1]);
  }
  if (texts[0]?.trim() === code) return true;
  return getRowPlainText(trXml).includes(code);
}

function highlightCellXml(cellXml) {
  let cell = cellXml;

  if (cell.includes('<w:tcPr>')) {
    if (!cell.includes('<w:shd')) {
      cell = cell.replace(
        '<w:tcPr>',
        `<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${BELOW_PLAN_FILL}"/>`,
      );
    }
  } else {
    cell = cell.replace(
      /^(<w:tc[^>]*>)/,
      `$1<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${BELOW_PLAN_FILL}"/></w:tcPr>`,
    );
  }

  cell = cell.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (full, inner) => {
    if (inner.includes('w:color')) {
      return full.replace(/<w:color w:val="[^"]*"\/>/, `<w:color w:val="${BELOW_PLAN_TEXT}"/>`);
    }
    return `<w:rPr><w:color w:val="${BELOW_PLAN_TEXT}"/>${inner}</w:rPr>`;
  });

  cell = cell.replace(/<w:r>(?![\s\S]*<w:rPr>)([\s\S]*?)<\/w:r>/g, (full, inner) => {
    return `<w:r><w:rPr><w:color w:val="${BELOW_PLAN_TEXT}"/></w:rPr>${inner}</w:r>`;
  });

  return cell;
}

function highlightMatrixRowXml(trXml) {
  let cellIndex = 0;
  return trXml.replace(/<w:tc([^>]*)>([\s\S]*?)<\/w:tc>/g, (full, attrs, inner) => {
    const idx = cellIndex++;
    if (!MATRIX_SCORE_COLUMN_INDEXES.includes(idx)) {
      return full;
    }
    return highlightCellXml(`<w:tc${attrs}>${inner}</w:tc>`);
  });
}

function applyMatrixRowHighlighting(docxBuffer, codesToHighlight) {
  if (!codesToHighlight?.length) return docxBuffer;

  const PizZip = require('pizzip');
  const zip = new PizZip(docxBuffer);
  const documentPath = 'word/document.xml';
  let xml = zip.file(documentPath).asText();

  const uniqueCodes = [...new Set(codesToHighlight.filter(Boolean))];

  xml = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tableXml) => {
    const colCount = (tableXml.match(/<w:gridCol/g) || []).length;
    if (colCount !== MATRIX_TABLE_COLUMN_COUNT) return tableXml;

    return tableXml.replace(/<w:tr[\s\S]*?<\/w:tr>/g, (trXml) => {
      const matched = uniqueCodes.some((code) => rowMatchesCode(trXml, code));
      if (!matched) return trXml;
      return highlightMatrixRowXml(trXml);
    });
  });

  zip.file(documentPath, xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function getBelowPlanMatrixCodes(matrixGrouped) {
  return matrixGrouped
    .filter(
      (row) =>
        row.rowType === 'criteria' &&
        row.code &&
        Number(row.currentLevel) < Number(row.expectedLevel),
    )
    .map((row) => row.code);
}

module.exports = {
  applyMatrixRowHighlighting,
  getBelowPlanMatrixCodes,
};
