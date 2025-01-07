const db = require('../config/db');

exports.searchUsers = async (req, res) => {
    try {
      const { search } = req.query;
      const limit = parseInt(req.query.limit) || 10;
  
      const [users] = await db.execute(`
        SELECT id, username as name, email 
        FROM users 
        WHERE (username LIKE ? OR email LIKE ?) 
        LIMIT ?
      `, [`%${search}%`, `%${search}%`, limit]);
      
      res.json({ users });
    } catch (error) {
   
      res.status(500).json({ message: 'Server error' });
    }
  };

exports.updateUserProfile= async(req,res)=>{
    try{
        const {name}=req.body;
        const {id}=req.user;
        await db.execute('UPDATE users SET username=? WHERE id=?',[name,id]);
        res.json({name});
    }catch(error){
        res.status(500).json({message:'Server error'});
    }
}