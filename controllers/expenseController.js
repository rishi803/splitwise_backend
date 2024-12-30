const db= require('../config/db');

exports.addExpense= async(req, res)=>{
    try{
      const {groupId, amount, description, splitType= 'EQUAL'}= req.body;
      const padiBy= req.user.id;

      const connection= await db.getConnection();
      await connection.beginTransaction();

      try{
          const[result]=  await connection.execute('INSERT INTO expenses (group_id, amount, description, paid_by, split_type) VALUES (?,?,?,?,?)');

            // find total group members for split money

          const [members]= await  connection.execute('SELECT user_id FROM group_members WHERE group_id= ?', [groupId]);

          const splitAmount= amount/members.length;

          // now create expense split and keep in expense_split table

            const expenseSplit= members.map(member=> [result.insertId, member.user_id, splitAmount]);

            await connection.execute('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ?', [expenseSplit]);

            await connection.commit();
            res.status(201).json({message: 'Expense added successfully'});
      }
      catch{
            await connection.rollback();
            throw error;
      }
      finally {
        connection.release();
      }

    }
    catch(error){
        es.status(500).json({ message: 'Server error' });
    }
}