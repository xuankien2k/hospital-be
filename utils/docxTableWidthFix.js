const WIDTH_PRESETS = {
  3: [4500, 1800, 1800],
  5: [700, 3500, 1800, 1400, 1200],
  6: [600, 1100, 3600, 1000, 1000, 2000],
  7: [2400, 900, 900, 900, 900, 900, 900],
};

function ensureFixedTableLayout(tblPrContent) {
  if (tblPrContent.includes('w:tblLayout')) return tblPrContent;
  return `${tblPrContent}<w:tblLayout w:type="fixed"/>`;
}

function setCellWidth(cellXml, width) {
  if (cellXml.includes('<w:tcPr>')) {
    if (cellXml.includes('<w:tcW')) {
      return cellXml.replace(/<w:tcW[^>]*\/>/, `<w:tcW w:w="${width}" w:type="dxa"/>`);
    }
    return cellXml.replace('<w:tcPr>', `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>`);
  }
  return cellXml.replace(/^(<w:tc[^>]*>)/, `$1<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>`);
}

function fixTableBlock(tableXml) {
  const colCount = (tableXml.match(/<w:gridCol/g) || []).length;
  const widths = WIDTH_PRESETS[colCount];
  if (!widths || widths.length !== colCount) return tableXml;

  let gridIndex = 0;
  let fixed = tableXml.replace(/<w:gridCol w:w="[^"]*"/g, () => {
    const width = widths[gridIndex++];
    return `<w:gridCol w:w="${width}"`;
  });

  fixed = fixed.replace(/<w:tblPr>([\s\S]*?)<\/w:tblPr>/, (match, inner) => {
    return `<w:tblPr>${ensureFixedTableLayout(inner)}</w:tblPr>`;
  });

  fixed = fixed.replace(/<w:tr>([\s\S]*?)<\/w:tr>/g, (rowXml) => {
    let cellIndex = 0;
    return rowXml.replace(/<w:tc([^>]*)>([\s\S]*?)<\/w:tc>/g, (full, attrs, inner) => {
      if (cellIndex >= widths.length) return full;
      const width = widths[cellIndex++];
      return setCellWidth(`<w:tc${attrs}>${inner}</w:tc>`, width);
    });
  });

  return fixed;
}

function applyTableColumnWidths(docxBuffer) {
  const PizZip = require('pizzip');
  const zip = new PizZip(docxBuffer);
  const documentPath = 'word/document.xml';
  let xml = zip.file(documentPath).asText();

  xml = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tableXml) => fixTableBlock(tableXml));

  zip.file(documentPath, xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { applyTableColumnWidths };
