const { loadReportData } = require('../services/reportDataService');
const { exportReportDocx } = require('../services/reportExportService');
const {
  loadTrendReport,
  captureMonthSnapshot,
  listAvailablePeriods,
} = require('../services/trendReportService');

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

exports.getTrends = async (req, res) => {
  try {
    const trend = await loadTrendReport(req);
    return res.json({
      message: 'Lấy dữ liệu xu hướng thành công',
      trend,
    });
  } catch (error) {
    console.error('Lỗi báo cáo xu hướng:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

exports.getSnapshots = async (req, res) => {
  try {
    const periods = await listAvailablePeriods();
    return res.json({
      message: 'Lấy danh sách mốc snapshot thành công',
      periods,
    });
  } catch (error) {
    console.error('Lỗi danh sách snapshot:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

exports.captureSnapshot = async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await captureMonthSnapshot({ force, snapshotType: 'manual' });
    return res.json({
      message: result.created ? 'Đã chụp snapshot tháng hiện tại' : 'Snapshot tháng hiện tại đã tồn tại',
      created: result.created,
      period: {
        year: result.snapshot.year,
        month: result.snapshot.month,
        periodKey: result.snapshot.periodKey,
        snapshotAt: result.snapshot.snapshotAt,
      },
    });
  } catch (error) {
    console.error('Lỗi chụp snapshot:', error);
    return res.status(500).json({ message: 'Không chụp được snapshot' });
  }
};
