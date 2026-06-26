const { loadReportData } = require('../services/reportDataService');
const { exportReportDocx } = require('../services/reportExportService');

exports.getReport = async (req, res) => {
  try {
    const report = await loadReportData(req);
    return res.json({
      message: 'Báo cáo chất lượng bệnh viện thành công',
      report,
    });
  } catch (error) {
    console.error('Lỗi báo cáo:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const report = await loadReportData(req);
    const buffer = exportReportDocx(report);
    const filename = `Bao-cao-CTCL-${new Date().toISOString().slice(0, 10)}.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Lỗi xuất báo cáo:', error);
    const message =
      error.message && error.message.includes('template')
        ? error.message
        : 'Không xuất được báo cáo Word';
    return res.status(500).json({ message });
  }
};
