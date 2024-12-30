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

exports.getGroupDetails = async (req, res) => {
  try {
    const [group] = await db.execute(`
      SELECT g.*, 
        COUNT(DISTINCT gm.user_id) as memberCount,
        COALESCE(SUM(e.amount), 0) as totalExpense
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN expenses e ON g.id = e.group_id
      WHERE g.id = ? AND gm.user_id = ?
      GROUP BY g.id
    `, [req.params.id, req.user.id]);
    // console.log(group)
    if (!group.length) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.json(group[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getGroupExpenses = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [expenses] = await db.execute(`
      SELECT e.*, u.username as paid_by_name
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      WHERE e.group_id = ?
      ORDER BY e.created_at DESC
    `, [id]);

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getGroupMembers = async (req, res) => {
  try {
    const [members] = await db.execute(`
      SELECT u.id, u.username as name
      FROM users u
      JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = ?
    `, [req.params.id]);

    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};