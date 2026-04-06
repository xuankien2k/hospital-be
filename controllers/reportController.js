const mongoose = require('mongoose');
const Criteria = require('../models/Criteria');

// Chương C3, C5 nhân hệ số 2 (hỗ trợ mã dạng C3, C5 hoặc C3.x, C5.x)
const getChapterCoefficient = (chapter) => {
  if (!chapter) return 1;
  const ch = String(chapter);
  if (ch === 'C3' || ch === 'C5') return 2;
  if (ch.startsWith('C3.') || ch.startsWith('C5.')) return 2;
  return 1;
};

exports.getReport = async (req, res) => {
  try {
    const filter = {};
    // Ban Giám đốc, Phòng QLCL (và admin cũ) xem toàn bộ báo cáo; Khoa/phòng và Cán bộ chỉ xem tiêu chí được phân công
    const canSeeAll = ['admin', 'quality_admin', 'director'].includes(req.user.role);
    if (!canSeeAll) {
      filter.assignedUser = req.user.userId;
    }
    // Bộ lọc bổ sung nếu có từ client
    const { part, chapter, keyword, assignedUser: assignedUserFilter } = req.body;
    if (part) filter.part = part;
    if (chapter) filter.chapter = chapter;
    if (keyword) {
      filter.$or = [
        { code: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } }
      ];
    }
    // Lọc theo người phụ trách: chỉ role được xem toàn bộ mới áp dụng (còn lại đã bị gán theo user)
    if (canSeeAll && assignedUserFilter && mongoose.Types.ObjectId.isValid(assignedUserFilter)) {
      filter.assignedUser = assignedUserFilter;
    }

    // Chỉ tính điểm các tiêu chí đang kích hoạt (bản ghi cũ không có trường status vẫn tính)
    filter.status = { $ne: false };

    // Lấy tiêu chí và populate thông tin assignedUser (username, email)
    const criterias = await Criteria.find(filter)
      .sort({ code: 1 })
      .populate('assignedUser', 'username email');

    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Tạo báo cáo chi tiết cho từng tiêu chí
    const criteriaReport = criterias.map(criteria => {
      const coefficient = getChapterCoefficient(criteria.chapter);
      totalWeightedScore += (criteria.currentLevel * coefficient);
      totalWeight += coefficient;
      
      return {
        _id: criteria._id,
        code: criteria.code,
        name: criteria.name,
        currentLevel: criteria.currentLevel,
        // Ngày hoàn thành tiêu chí nếu có (criteriaActualCompletionDate)
        criteriaActualCompletionDate: criteria.criteriaActualCompletionDate,
        // Danh sách các level cùng thông tin ngày hoàn thành (actualCompletionDate) của từng level
        levels: criteria.levels.map(l => ({
          levelNumber: l.levelNumber,
          actualCompletionDate: l.actualCompletionDate,
          subCriterias: l.subCriterias
        })),
        expectedLevel: criteria.expectedLevel,
        expectedLevelCompletionDate: criteria.expectedLevelCompletionDate,
        coefficient,
        part: criteria.part,
        chapter: criteria.chapter,
        assignedUser: criteria.assignedUser, // Thông tin người được phân công (username, email)
        updatedAt: criteria.updatedAt,
        status: criteria.status,
        progress: criteria.progress,
      };
    });

    const totalCriteria = criterias.length;
    // Điểm = (tổng level × hệ số chương, C3/C5 x2) / tổng số tiêu chí
    const overallScore = totalCriteria ? totalWeightedScore / totalCriteria : 0;
    // Giữ tương thích: trung bình có trọng số theo hệ số chương (khác công thức điểm trên)
    const weightedAverageByChapter = totalWeight ? totalWeightedScore / totalWeight : 0;

    return res.json({
      message: "Báo cáo chất lượng bệnh viện thành công",
      report: {
        totalCriteria,
        totalWeightedScore,
        totalWeight,
        overallScore,
        weightedAverageByChapter,
        overallAverage: overallScore,
        details: criteriaReport
      }
    });
  } catch (error) {
    console.error("Lỗi báo cáo:", error);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};