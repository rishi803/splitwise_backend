const db= require('../config/db');


exports.getGroups = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;

    const [groups] = await db.execute(`
      SELECT g.*, 
        COUNT(DISTINCT gm.user_id) as memberCount,
        COALESCE(SUM(e.amount), 0) as totalExpense
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN expenses e ON g.id = e.group_id
      WHERE gm.user_id = ?
      GROUP BY g.id
      LIMIT ? OFFSET ?
    `, [req.user.id, limit, offset]);

    const [totalCount] = await db.execute(
      'SELECT COUNT(*) as total FROM group_members WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      groups,
      total: totalCount[0].total,
      currentPage: page,
      totalPages: Math.ceil(totalCount[0].total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};