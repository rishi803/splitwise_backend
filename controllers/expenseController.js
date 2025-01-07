const db= require('../config/db');

exports.addExpense = async (req, res) => {
    try {
      // const { error } = validateExpense(req.body);
      // if (error) return res.status(400).json({ message: error.details[0].message });
  
      const { groupId, amount, description,paidBy, splitType = 'EQUAL' } = req.body;
      // const paidBy = req.user.id;
  
      const connection = await db.getConnection();
      await connection.beginTransaction();
     
      try {
        
       
        const [result] = await connection.execute(
          'INSERT INTO expenses (group_id, amount, description, paid_by, split_type) VALUES (?, ?, ?, ?, ?)',
          [groupId, amount, description, paidBy, splitType]
        );
        
       
        const [members] = await connection.execute(
          'SELECT user_id FROM group_members WHERE group_id = ?',
          [groupId]
        );
       
      
        const splitAmount = amount / members.length;
  
        // Create expense splits
        const splitValues = members.map(member => [
          result.insertId,
          member.user_id,
          splitAmount
        ]);
  
        await connection.query(
          'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ?',
          [splitValues]
        );
  
        await connection.commit();
        res.status(201).json({ message: 'Expense added successfully' });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  };
  