const Criteria = require('../models/Criteria');
const mongoose = require('mongoose');
const Department = require('../models/Department');
const { CRITERIA_EXCLUDED_DEPARTMENT_NAMES } = require('../constants/departments');
const { getCriteriaDepartmentFilter, applyDepartmentToCriteria, buildDepartmentIdFilter, getUserWithDepartment, assertDepartmentHeadCanAssignDepartment } = require('../utils/departmentAccess');
const {
    isRestrictedCriteriaEditor,
    validateLevelsStructure,
    mergeRestrictedLevelsUpdate,
} = require('../utils/criteriaUpdateAccess');

async function validateCriteriaDepartmentId(departmentId) {
    if (!departmentId) {
        return { ok: false, message: 'Vui lòng chọn khoa/phòng' };
    }
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return { ok: false, message: 'Khoa/phòng không hợp lệ' };
    }
    const dept = await Department.findById(departmentId);
    if (!dept) {
        return { ok: false, message: 'Khoa/phòng không tồn tại' };
    }
    if (CRITERIA_EXCLUDED_DEPARTMENT_NAMES.includes(dept.name)) {
        return { ok: false, message: 'Không thể gán tiêu chí cho Ban giám đốc' };
    }
    return { ok: true, dept };
}

const normalizeLevels = (levels = []) => {
    if (!Array.isArray(levels)) return levels;
    return levels.map((level) => ({
        ...level,
        subCriterias: Array.isArray(level.subCriterias)
            ? level.subCriterias.map((subCriteria) => ({
                ...subCriteria,
                evidences: Array.isArray(subCriteria.evidences)
                    ? subCriteria.evidences.filter((link) => typeof link === 'string')
                    : []
            }))
            : []
    }));
};

// Tạo mới tiêu chí (admin, quality_admin)
exports.createCriteria = async (req, res) => {
    try {
        const { code, name, part, chapter, description, expectedCompletionDate, assignedUser, levels, expectedLevel, expectedLevelCompletionDate, departmentId } = req.body;

        // Kiểm tra trùng mã tiêu chí
        const existing = await Criteria.findOne({ code });
        if (existing) {
            return res.status(400).json({ message: 'Mã tiêu chí đã tồn tại' });
        }

        const normalizedLevels = normalizeLevels(levels);

        const deptCheck = await validateCriteriaDepartmentId(departmentId);
        if (!deptCheck.ok) {
            return res.status(400).json({ message: deptCheck.message });
        }

        const newCriteria = new Criteria({
            code,
            name,
            part,
            chapter,
            description,
            expectedCompletionDate,
            assignedUser,
            levels: normalizedLevels,
            expectedLevel,
            expectedLevelCompletionDate,
            status: req.body.status !== undefined ? Boolean(req.body.status) : true,
        });
        await applyDepartmentToCriteria(newCriteria, departmentId);
        newCriteria.currentLevel = Criteria.calculateCurrentLevel(normalizedLevels);
        await newCriteria.save(); // pre-save hook đồng bộ currentLevel / progress / ngày hoàn thành

        return res.status(201).json({
            message: 'Tạo tiêu chí thành công',
            criteria: newCriteria
        });
    } catch (error) {
        console.error('Lỗi tạo tiêu chí:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Cập nhật tiêu chí (chỉ admin)
exports.updateCriteria = async (req, res) => {
    try {
            const { _id, code, name, part, chapter, description, expectedCompletionDate, assignedUser, levels, expectedLevel, expectedLevelCompletionDate, status, departmentId } = req.body;

        const criteria = await Criteria.findById(_id);
        if (!criteria) {
            return res.status(404).json({ message: 'Không tìm thấy tiêu chí' });
        }

        // Cán bộ phụ trách tiêu chí chỉ được cập nhật tiêu chí được phân công cho chính mình.
        if (req.user?.role === 'criteria_officer') {
            const isAssignedToCurrentUser =
                criteria.assignedUser && criteria.assignedUser.toString() === req.user.userId;
            if (!isAssignedToCurrentUser) {
                return res.status(403).json({ message: 'Bạn chỉ được cập nhật tiêu chí được phân công' });
            }
        }

        if (req.user?.role === 'department') {
            const user = await getUserWithDepartment(req.user.userId);
            const userDeptId = user?.departmentId?._id || user?.departmentId;
            const criteriaDeptId = criteria.departmentId;
            if (criteriaDeptId && userDeptId && String(criteriaDeptId) !== String(userDeptId)) {
                return res.status(403).json({ message: 'Bạn chỉ được sửa tiêu chí thuộc khoa/phòng của mình' });
            }
        }

        if (isRestrictedCriteriaEditor(req.user?.role)) {
            if (!levels) {
                return res.status(400).json({ message: 'Không có dữ liệu cập nhật' });
            }
            if (!validateLevelsStructure(criteria.levels, levels)) {
                return res.status(403).json({
                    message: 'Không được thêm, xóa hoặc đổi tên tiểu mục',
                });
            }
            const mergedLevels = mergeRestrictedLevelsUpdate(criteria.levels, levels);
            criteria.levels = mergedLevels;
            criteria.markModified('levels');
            criteria.currentLevel = Criteria.calculateCurrentLevel(mergedLevels);
            await criteria.save();

            return res.json({
                message: 'Cập nhật tiêu chí thành công',
                criteria,
            });
        }

        // Nếu cập nhật mã và khác với mã hiện tại, kiểm tra trùng lặp
        if (code && code !== criteria.code) {
            const check = await Criteria.findOne({ code });
            if (check) {
                return res.status(400).json({ message: 'Mã tiêu chí đã tồn tại' });
            }
            criteria.code = code;
        }
        if (name) criteria.name = name;
        if (part) criteria.part = part;
        if (chapter) criteria.chapter = chapter;
        if (description) criteria.description = description;
        if (expectedCompletionDate) criteria.expectedCompletionDate = expectedCompletionDate;
        if (assignedUser) criteria.assignedUser = assignedUser;
        if (levels) {
            const normalizedLevels = normalizeLevels(levels);
            criteria.levels = normalizedLevels;
            criteria.markModified('levels');
            // Tính lại currentLevel từ payload đã chuẩn hóa (đồng bộ FE; tránh lệch Mongoose subdocument)
            criteria.currentLevel = Criteria.calculateCurrentLevel(normalizedLevels);
        }
        if (departmentId !== undefined) {
            const deptCheck = await validateCriteriaDepartmentId(departmentId);
            if (!deptCheck.ok) {
                return res.status(400).json({ message: deptCheck.message });
            }
            await applyDepartmentToCriteria(criteria, departmentId);
        }
        if (expectedLevel) criteria.expectedLevel = expectedLevel;
        if (expectedLevelCompletionDate) criteria.expectedLevelCompletionDate = expectedLevelCompletionDate;
        // Bật/tắt tiêu chí: không cho criteria_officer thay đổi
        if (status !== undefined && req.user?.role !== 'criteria_officer') {
            criteria.status = Boolean(status);
        }

        await criteria.save();

        return res.json({
            message: 'Cập nhật tiêu chí thành công',
            criteria
        });
    } catch (error) {
        console.error('Lỗi cập nhật tiêu chí:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Xóa tiêu chí (chỉ admin)
// Cho phép truyền vào "ids" là mảng các _id tiêu chí cần xóa (hoặc 1 _id dưới dạng string)
exports.deleteCriteria = async (req, res) => {
    try {
        let { ids } = req.body; // nhận "ids" từ body

        if (!ids) {
            return res.status(400).json({ message: 'Không tìm thấy tiêu chí cần xóa' });
        }

        // Nếu không phải mảng, chuyển nó thành mảng
        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        const result = await Criteria.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tiêu chí cần xóa' });
        }

        return res.json({
            message: 'Xóa tiêu chí thành công',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Lỗi xóa tiêu chí:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Lấy danh sách tiêu chí (User chỉ xem tiêu chí được phân công, Admin xem tất cả)
exports.getList = async (req, res) => {
    try {
        const { part, chapter, keyword, out_of_date, departmentId } = req.body;
        const andConditions = [];

        if (part) andConditions.push({ part });
        if (chapter) andConditions.push({ chapter });
        if (keyword) {
            andConditions.push({
                $or: [
                    { code: { $regex: keyword, $options: 'i' } },
                    { name: { $regex: keyword, $options: 'i' } },
                ],
            });
        }

        if (out_of_date) {
            const dateToCompare = new Date(out_of_date);
            if (!isNaN(dateToCompare.getTime())) {
                andConditions.push({ expectedLevelCompletionDate: { $lt: dateToCompare } });
            }
        }

        const deptFilter = await getCriteriaDepartmentFilter(req.user.userId, req.user.role);
        if (deptFilter) andConditions.push(deptFilter);

        const departmentFilter = buildDepartmentIdFilter(departmentId);
        if (departmentFilter) andConditions.push(departmentFilter);

        const filter = andConditions.length > 0 ? { $and: andConditions } : {};

        const criterias = await Criteria.find(filter)
            .sort({ code: 1 })
            .populate('assignedUser', 'username email department departmentId')
            .populate('departmentId', 'name');

        return res.json({
            message: 'Lấy danh sách tiêu chí thành côngg',
            data: criterias
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách tiêu chí:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Lấy chi tiết tiêu chí
exports.getDetail = async (req, res) => {
    try {
        const { _id } = req.body;
        const criteria = await Criteria.findById(_id)
            .populate('assignedUser', 'username email department departmentId')
            .populate('departmentId', 'name');

        if (!criteria) {
            return res.status(404).json({ message: 'Không tìm thấy tiêu chí' });
        }
        return res.json({
            message: 'Lấy chi tiết tiêu chí thành công',
            criteria
        });
    } catch (error) {
        console.error('Lỗi lấy chi tiết tiêu chí:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};
