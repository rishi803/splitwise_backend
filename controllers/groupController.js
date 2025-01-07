const db= require('../config/db');
const { validateGroup } = require('../utils/validation');


exports.createGroup = async (req, res) => {
  try {
    const { error } = validateGroup(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, memberIds } = req.body;
    const userId = req.user.id;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [result] = await connection.execute(
        'INSERT INTO groups (name, created_by) VALUES (?, ?)',
        [name, userId]
      );

      const groupId = result.insertId;
      const memberValues = [...memberIds].map(memberId => [groupId, memberId]);
      
      await connection.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ?',
        [memberValues]
      );

      await connection.commit();
      res.status(201).json({ id: groupId, name });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addGroupMembers = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { memberIds } = req.body;

    // Validate input
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "Invalid member IDs" });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if group exists and user is a member
      const [groupCheck] = await connection.execute(
        'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, req.user.id]
      );

      if (groupCheck.length === 0) {
        await connection.rollback();
        return res.status(403).json({ message: "You are not a member of this group" });
      }

      // Filter out existing members
      let existingMembers = [];
      if (memberIds.length > 0) {
        [existingMembers] = await connection.execute(
          `SELECT user_id FROM group_members WHERE group_id = ? AND user_id IN (${memberIds.map(() => '?').join(',')})`,
          [groupId, ...memberIds]
        );
      }

      const existingMemberIds = existingMembers.map(m => m.user_id);
      const newMemberIds = memberIds.filter(id => !existingMemberIds.includes(id));

      // Insert new members with current timestamp
      if (newMemberIds.length > 0) {
        const memberValues = newMemberIds.map(memberId => [groupId, memberId, new Date()]);
        
        await connection.query(
          'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ?',
          [memberValues]
        );
      }

      await connection.commit();
      
      res.status(201).json({ 
        message: "Members added successfully",
        addedMembers: newMemberIds,
        existingMembers: existingMemberIds
      });
    } catch (error) {
      await connection.rollback();
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getGroups = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    let query = `
      SELECT g.*, 
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as memberCount,
       COALESCE(SUM(e.amount), 0) as totalExpense
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN expenses e ON g.id = e.group_id
      WHERE gm.user_id = ?
    `;

    // Add search condition if 'search' query is provided
    if (search) {
      query += ` AND g.name LIKE ?`;
    }

    query += `
      GROUP BY g.id
      LIMIT ? OFFSET ?
    `;

    const queryParams = search
      ? [req.user.id, search, limit, offset]
      : [req.user.id, limit, offset];

    const [groups] = await db.execute(query, queryParams);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
    `;

    const countParams = search ? [req.user.id, search] : [req.user.id];

    const [totalCount] = await db.execute(
      search ? `${countQuery} AND g.name LIKE ?` : countQuery,
      countParams
    );

    res.json({
      groups,
      total: totalCount[0].total,
      currentPage: page,
      totalPages: Math.ceil(totalCount[0].total / limit),
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getGroupDetails = async (req, res) => {
  try {
    const [group] = await db.execute(`
      SELECT 
        g.*,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as memberCount,
        COALESCE(SUM(e.amount), 0) as totalExpense
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN expenses e ON g.id = e.group_id
      WHERE g.id = ? AND gm.user_id = ?
      GROUP BY g.id
    `, [req.params.id, req.user.id]);

    if (!group.length) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Calculate member balances with consideration for join date
    const [memberBalances] = await db.execute(`
      WITH member_expenses AS (
        SELECT 
          u.id,
          u.username,
          gm.joined_at,
          COALESCE(SUM(CASE 
            WHEN e.paid_by = u.id THEN e.amount 
            ELSE 0 
          END), 0) as paid,
          COALESCE(SUM(CASE 
            WHEN e.created_at >= gm.joined_at THEN e.amount / (
              SELECT COUNT(*) 
              FROM group_members gm2 
              WHERE gm2.group_id = ? 
              AND gm2.joined_at <= e.created_at
            )
            ELSE 0 
          END), 0) as share
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        LEFT JOIN expenses e ON e.group_id = ?
        WHERE gm.group_id = ?
        GROUP BY u.id, u.username, gm.joined_at
      )
      SELECT 
        id,
        username,
        paid,
        share,
        (paid - share) as balance
      FROM member_expenses
      ORDER BY balance DESC
    `, [req.params.id, req.params.id, req.params.id]);

    res.json({
      ...group[0],
      memberBalances
    });
  } catch (error) {
    console.error(error);
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

exports.getGroupExpenseChart = async (req, res) => {
  try {
    const [expenses] = await db.execute(`
      SELECT 
        DATE(created_at) as date,
        ROUND(SUM(amount), 2) as amount
      FROM expenses
      WHERE group_id = ?
      AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [req.params.id]);

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const groupId = req.params.id;

    const [group] = await db.execute(
      'SELECT * FROM groups WHERE id = ? AND created_by = ?',
      [groupId, req.user.id]
    );

    if (!group.length) {
      return res.status(403).json({ message: 'Not authorized to update this group' });
    }

    await db.execute(
      'UPDATE groups SET name = ? WHERE id = ?',
      [name, groupId]
    );

    res.json({ message: 'Group name updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
  
    const [group] = await db.execute(
      'SELECT * FROM groups WHERE id = ? AND created_by = ?',
      [groupId, req.user.id]
    );
   
    if (!group.length) {
      return res.status(403).json({ message: 'Not authorized to delete' });
    }
  
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      await connection.execute('DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = ?)', [groupId]);
      await connection.execute('DELETE FROM expenses WHERE group_id = ?', [groupId]);
      await connection.execute('DELETE FROM group_members WHERE group_id = ?', [groupId]);
      await connection.execute('DELETE FROM groups WHERE id = ?', [groupId]);

      await connection.commit();
      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ message: 'Not authorized to delete' });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeGroupMembers = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id: groupId } = req.params;
    const { memberIds } = req.body;
    
    // Check if user is group admin
    const [adminCheck] = await connection.execute(
      'SELECT created_by FROM groups WHERE id = ?',
      [groupId]
    );
    
    if (adminCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ message: 'Only group admin can remove members' });
    }

    // Prevent removing admin
    if (memberIds.includes(adminCheck[0].created_by)) {
      return res.status(400).json({ message: 'Cannot remove group admin' });
    }

    // Check if members have zero balance
    const [balanceCheck] = await connection.execute(`
      WITH member_expenses AS (
        SELECT 
          u.id,
          COALESCE(SUM(CASE 
            WHEN e.paid_by = u.id THEN e.amount 
            ELSE 0 
          END), 0) as paid,
          COALESCE(SUM(CASE 
            WHEN e.created_at >= gm.joined_at THEN e.amount / (
              SELECT COUNT(*) 
              FROM group_members gm2 
              WHERE gm2.group_id = ?
              AND gm2.joined_at <= e.created_at
            )
            ELSE 0 
          END), 0) as share
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        LEFT JOIN expenses e ON e.group_id = ?
        WHERE gm.group_id = ? AND u.id IN (?)
        GROUP BY u.id
      )
      SELECT 
        id, 
        (paid - share) as balance
      FROM member_expenses
      WHERE ABS(paid - share) > 0.01
    `, [groupId, groupId, groupId, ...memberIds]);

    if (balanceCheck.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot remove members with non-zero balance',
        nonZeroBalanceMembers: balanceCheck.map(b => b.id)
      });
    }

    // Remove members
    await connection.execute(
      'DELETE FROM group_members WHERE group_id = ? AND user_id IN (?)',
      [groupId, ...memberIds]
    );

    await connection.commit();
    
    res.json({ 
      message: 'Members removed successfully',
      removedMembers: memberIds 
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
};