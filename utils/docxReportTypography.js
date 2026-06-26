const REPORT_FONT = 'Times New Roman';
const REPORT_FONT_SIZE = '26'; // 13pt (half-points)
const LINE_SPACING = '<w:spacing w:line="360" w:lineRule="auto"/>';
const FONT_RUN_PROPS =
  `<w:rFonts w:ascii="${REPORT_FONT}" w:hAnsi="${REPORT_FONT}" w:cs="${REPORT_FONT}" w:ea="${REPORT_FONT}"/><w:sz w:val="${REPORT_FONT_SIZE}"/><w:szCs w:val="${REPORT_FONT_SIZE}"/>`;

const SECTION_TITLE_PATTERN = /^(I{1,3}|IV|V|VI)\.\s+/;

function ensureRunProperties(rPrInner) {
  let inner = rPrInner || '';

  if (inner.includes('w:rFonts')) {
    inner = inner.replace(
      /<w:rFonts[^>]*\/>/,
      `<w:rFonts w:ascii="${REPORT_FONT}" w:hAnsi="${REPORT_FONT}" w:cs="${REPORT_FONT}" w:ea="${REPORT_FONT}"/>`,
    );
  } else {
    inner = `<w:rFonts w:ascii="${REPORT_FONT}" w:hAnsi="${REPORT_FONT}" w:cs="${REPORT_FONT}" w:ea="${REPORT_FONT}"/>${inner}`;
  }

  if (inner.includes('w:sz')) {
    inner = inner.replace(/<w:sz w:val="[^"]*"/, `<w:sz w:val="${REPORT_FONT_SIZE}"`);
  } else {
    inner = `<w:sz w:val="${REPORT_FONT_SIZE}"/>${inner}`;
  }

  if (inner.includes('w:szCs')) {
    inner = inner.replace(/<w:szCs w:val="[^"]*"/, `<w:szCs w:val="${REPORT_FONT_SIZE}"`);
  } else {
    inner = `<w:szCs w:val="${REPORT_FONT_SIZE}"/>${inner}`;
  }

  return inner;
}

function isSectionTitleParagraph(paragraphXml) {
  const text = [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .trim();
  return SECTION_TITLE_PATTERN.test(text);
}

function applyParagraphSpacing(pPrInner) {
  let inner = pPrInner || '';
  if (inner.includes('w:spacing')) {
    return inner.replace(/<w:spacing[^>]*\/>/, LINE_SPACING);
  }
  return `${LINE_SPACING}${inner}`;
}

function applyReportTypography(docxBuffer) {
  const PizZip = require('pizzip');
  const zip = new PizZip(docxBuffer);
  const documentPath = 'word/document.xml';
  let xml = zip.file(documentPath).asText();

  xml = xml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (full, inner) => {
    return `<w:rPr>${ensureRunProperties(inner)}</w:rPr>`;
  });

  xml = xml.replace(/<w:r>((?!<w:rPr>)[\s\S]*?)<\/w:r>/g, (full, inner) => {
    if (inner.includes('<w:rPr>')) return full;
    return `<w:r><w:rPr>${FONT_RUN_PROPS}</w:rPr>${inner}</w:r>`;
  });

  xml = xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (full, inner) => {
    return `<w:pPr>${applyParagraphSpacing(inner)}</w:pPr>`;
  });

  xml = xml.replace(/<w:p>((?!<w:pPr>)[\s\S]*?)<\/w:p>/g, (full, inner) => {
    if (inner.trim().startsWith('<w:pPr>')) return full;
    return `<w:p><w:pPr>${LINE_SPACING}</w:pPr>${inner}</w:p>`;
  });

  xml = xml.replace(/<w:p>([\s\S]*?)<\/w:p>/g, (full, inner) => {
    if (!isSectionTitleParagraph(inner)) return full;

    const updated = inner.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (rFull, rInner) => {
      let props = ensureRunProperties(rInner);
      if (!props.includes('w:b')) {
        props = `<w:b/><w:bCs/>${props}`;
      }
      if (!props.includes('w:color')) {
        props = `<w:color w:val="000000"/>${props}`;
      } else {
        props = props.replace(/<w:color w:val="[^"]*"/, '<w:color w:val="000000"');
      }
      return `<w:rPr>${props}</w:rPr>`;
    });

    return `<w:p>${updated}</w:p>`;
  });

  zip.file(documentPath, xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { applyReportTypography };
