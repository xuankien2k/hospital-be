const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  TableLayoutType,
  LineRuleType,
} = require('docx');

const REPORT_FONT = 'Times New Roman';
const REPORT_FONT_SIZE = 26; // 13pt
const REPORT_LINE_SPACING = { line: 360, lineRule: LineRuleType.AUTO };

const TABLE_WIDTHS = {
  level: [2400, 900, 900, 900, 900, 900, 900],
  byPart: [4500, 1800, 1800],
  department: [700, 3500, 1800, 1400, 1200],
  list6: [600, 1100, 3600, 1000, 1000, 2000],
  subcriteriaDetail: [900, 900, 900, 3600, 1200, 1800, 1200],
  matrix: [1100, 4000, 1200, 1000, 2100],
};

const textRun = (text, opts = {}) =>
  new TextRun({
    text,
    font: REPORT_FONT,
    size: REPORT_FONT_SIZE,
    color: '000000',
    ...opts,
  });

const bodyParagraph = (text, opts = {}) =>
  new Paragraph({
    spacing: REPORT_LINE_SPACING,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [textRun(text, opts.run || {})],
  });

const sectionTitleParagraph = (text) =>
  new Paragraph({
    spacing: REPORT_LINE_SPACING,
    children: [textRun(text, { bold: true })],
  });

const emptyParagraph = () =>
  new Paragraph({
    spacing: REPORT_LINE_SPACING,
    children: [],
  });

const cell = (text, widthDxa, opts = {}) =>
  new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    children: [
      new Paragraph({
        spacing: REPORT_LINE_SPACING,
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [textRun(text, { bold: !!opts.bold })],
      }),
    ],
  });

const headerRow = (labels, columnWidths) =>
  new TableRow({
    children: labels.map((label, index) => cell(label, columnWidths[index], { bold: true })),
  });

const loopRow = (cells, columnWidths) =>
  new TableRow({
    children: cells.map(([text, opts], index) => cell(text, columnWidths[index], opts)),
  });

const makeTable = (columnWidths, rows) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows,
  });

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: REPORT_FONT,
          size: REPORT_FONT_SIZE,
          color: '000000',
        },
        paragraph: {
          spacing: REPORT_LINE_SPACING,
        },
      },
    },
  },
  sections: [
    {
      properties: {},
      children: [
        bodyParagraph('{reportTitle}', { center: true, run: { bold: true } }),
        bodyParagraph('Bệnh viện: {hospitalName}'),
        bodyParagraph('Địa chỉ: {address}'),
        bodyParagraph('Cơ quan chủ quản: {managingAgency}'),
        bodyParagraph('Hạng bệnh viện: {hospitalRank}'),
        bodyParagraph('Loại bệnh viện: {hospitalType}'),
        bodyParagraph('Ngày báo cáo: {reportDate}'),
        emptyParagraph(),

        sectionTitleParagraph('I. TÓM TẮT KẾT QUẢ BỘ TIÊU CHÍ CHẤT LƯỢNG BỆNH VIỆN'),
        bodyParagraph(
          'Tổng số tiêu chí được áp dụng đánh giá: {totalApplied}/{totalStandard} tiêu chí (không đánh giá {excludedCodesText})',
        ),
        bodyParagraph('Tỷ lệ tiêu chí áp dụng: {appliedPercent}%'),
        bodyParagraph('Tổng số điểm (hệ số C3/C5 ×2): {totalWeightedScore} (hệ số: {totalWeight})'),
        bodyParagraph('Điểm trung bình chung: {overallScore}'),
        emptyParagraph(),

        makeTable(TABLE_WIDTHS.level, [
          headerRow(
            ['Kết quả theo mức', 'Mức 1', 'Mức 2', 'Mức 3', 'Mức 4', 'Mức 5', 'Tổng'],
            TABLE_WIDTHS.level,
          ),
          loopRow(
            [
              ['Số lượng tiêu chí đạt', {}],
              ['{level1}', { center: true }],
              ['{level2}', { center: true }],
              ['{level3}', { center: true }],
              ['{level4}', { center: true }],
              ['{level5}', { center: true }],
              ['{totalApplied}', { center: true }],
            ],
            TABLE_WIDTHS.level,
          ),
          loopRow(
            [
              ['% tiêu chí đạt', {}],
              ['{level1Percent}', { center: true }],
              ['{level2Percent}', { center: true }],
              ['{level3Percent}', { center: true }],
              ['{level4Percent}', { center: true }],
              ['{level5Percent}', { center: true }],
              ['100%', { center: true }],
            ],
            TABLE_WIDTHS.level,
          ),
        ]),
        emptyParagraph(),
        new Paragraph({
          spacing: REPORT_LINE_SPACING,
          children: [
            textRun('Biểu đồ 1. Phân bố tiêu chí theo mức (xem bản web để in kèm biểu đồ)', {
              italics: true,
            }),
          ],
        }),
        emptyParagraph(),

        sectionTitleParagraph('II. KẾT QUẢ THEO NHÓM TIÊU CHÍ'),
        makeTable(TABLE_WIDTHS.byPart, [
          headerRow(['Nhóm tiêu chí', 'Số tiêu chí', 'Điểm trung bình'], TABLE_WIDTHS.byPart),
          loopRow(
            [
              ['{#byPart}{partLabel}', {}],
              ['{count}', { center: true }],
              ['{avgScore}{/byPart}', { center: true }],
            ],
            TABLE_WIDTHS.byPart,
          ),
        ]),
        emptyParagraph(),
        new Paragraph({
          spacing: REPORT_LINE_SPACING,
          children: [
            textRun('Biểu đồ 2. Điểm trung bình theo nhóm tiêu chí (xem bản web)', {
              italics: true,
            }),
          ],
        }),
        emptyParagraph(),

        sectionTitleParagraph('III. KẾT QUẢ THEO KHOA/PHÒNG PHỤ TRÁCH'),
        makeTable(TABLE_WIDTHS.department, [
          headerRow(
            ['STT', 'Khoa/phòng', 'Số tiêu chí phụ trách', 'Điểm TB', 'Xếp hạng'],
            TABLE_WIDTHS.department,
          ),
          loopRow(
            [
              ['{#byDepartment}{rank}', { center: true }],
              ['{name}', {}],
              ['{count}', { center: true }],
              ['{avgScore}', { center: true }],
              ['{rank}{/byDepartment}', { center: true }],
            ],
            TABLE_WIDTHS.department,
          ),
        ]),
        emptyParagraph(),

        sectionTitleParagraph('IV. DANH SÁCH CÁC TIÊU CHÍ DƯỚI MỨC 4'),
        makeTable(TABLE_WIDTHS.list6, [
          headerRow(
            ['STT', 'Mã', 'Tên tiêu chí', 'Mức đạt', 'Mức dự kiến', 'Khoa/phòng'],
            TABLE_WIDTHS.list6,
          ),
          loopRow(
            [
              ['{#belowLevel4}{stt}', { center: true }],
              ['{code}', {}],
              ['{name}', {}],
              ['{currentLevel}', { center: true }],
              ['{expectedLevel}', { center: true }],
              ['{departmentName}{/belowLevel4}', {}],
            ],
            TABLE_WIDTHS.list6,
          ),
        ]),
        emptyParagraph(),

        sectionTitleParagraph('V. CÁC TIÊU CHÍ CHƯA ĐẠT KẾ HOẠCH'),
        makeTable(TABLE_WIDTHS.subcriteriaDetail, [
          headerRow(
            [
              'Mã TC',
              'Mức đạt hiện tại',
              'Mức dự kiến',
              'Tiểu mục chưa đạt',
              'Thời gian hoàn thành',
              'Trách nhiệm',
              'Ghi chú',
            ],
            TABLE_WIDTHS.subcriteriaDetail,
          ),
          loopRow(
            [
              ['{#notAchievedSubcriteria}{code}', {}],
              ['{currentLevel}', { center: true }],
              ['{expectedLevel}', { center: true }],
              ['{subcriteriaText}', {}],
              ['{completionDate}', {}],
              ['{departmentName}', {}],
              ['{note}{/notAchievedSubcriteria}', {}],
            ],
            TABLE_WIDTHS.subcriteriaDetail,
          ),
        ]),
        emptyParagraph(),

        sectionTitleParagraph('VI. KẾT QUẢ ĐÁNH GIÁ THEO BỘ TIÊU CHÍ'),
        makeTable(TABLE_WIDTHS.matrix, [
          headerRow(
            ['Mã số', 'Chỉ tiêu', 'Điểm hiện tại', 'Kế hoạch', 'Khoa/phòng phụ trách'],
            TABLE_WIDTHS.matrix,
          ),
          loopRow(
            [
              ['{#matrix}{code}', {}],
              ['{name}', {}],
              ['{currentLevel}', { center: true }],
              ['{expectedLevel}', { center: true }],
              ['{departmentName}{/matrix}', {}],
            ],
            TABLE_WIDTHS.matrix,
          ),
        ]),
      ],
    },
  ],
});

async function main() {
  const outDir = path.join(__dirname, '../templates');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'bao-cao-ctcl.template.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('Template written:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
