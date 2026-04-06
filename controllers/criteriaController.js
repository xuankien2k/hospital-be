const Criteria = require('../models/Criteria');

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

// Tạo mới tiêu chí (chỉ admin)
exports.createCriteria = async (req, res) => {
    try {
        const { code, name, part, chapter, description, expectedCompletionDate, assignedUser, levels, expectedLevel, expectedLevelCompletionDate } = req.body;

        // Kiểm tra trùng mã tiêu chí
        const existing = await Criteria.findOne({ code });
        if (existing) {
            return res.status(400).json({ message: 'Mã tiêu chí đã tồn tại' });
        }

        const normalizedLevels = normalizeLevels(levels);
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
            const { _id, code, name, part, chapter, description, expectedCompletionDate, assignedUser, levels, expectedLevel, expectedLevelCompletionDate, status } = req.body;

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
        const { part, chapter, keyword, out_of_date } = req.body;
        const filter = {};

        if (part) filter.part = part;
        if (chapter) filter.chapter = chapter;
        if (keyword) {
            filter.$or = [
                { code: { $regex: keyword, $options: 'i' } },
                { name: { $regex: keyword, $options: 'i' } }
            ];
        }

        // Lọc tiêu chí có expectedLevelCompletionDate > ngày được chỉ định
        if (out_of_date) {
            const dateToCompare = new Date(out_of_date);
            console.log(dateToCompare);
            // Kiểm tra nếu ngày hợp lệ
            if (!isNaN(dateToCompare.getTime())) {
                // Tìm các tiêu chí có ngày hoàn thành dự kiến > ngày được chỉ định
                filter.expectedLevelCompletionDate = { $lt: dateToCompare };
            }
        }

        // Ban Giám đốc, Phòng QLCL, Khoa/phòng xem toàn bộ (để chỉnh sửa, phân công); chỉ Cán bộ tiêu chí xem tiêu chí được giao
        const canSeeAll = ['admin', 'quality_admin', 'director', 'department'].includes(req.user.role);
        if (!canSeeAll) {
            filter.assignedUser = req.user.userId;
        }

        // Populate trường assignedUser để lấy thông tin của user được gán (username, email,...)
        const criterias = await Criteria.find(filter)
            .sort({ code: 1 })
            .populate('assignedUser', 'username email');

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
            .populate('assignedUser', 'username email'); // populate thông tin người dùng

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
