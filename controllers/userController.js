const db = require('../config/db');

exports.searchUsers = async (req, res) => {
    try {
      const { q } = req.query;
      const limit = parseInt(req.query.limit) || 10;
  
      const [users] = await db.execute(`
        SELECT id, username as name, email 
        FROM users 
        WHERE (username LIKE ? OR email LIKE ?) 
        LIMIT ?
      `, [`%${q}%`, `%${q}%`, limit]);
      
      res.json({ users });
    } catch (error) {
   
      res.status(500).json({ message: 'Server error' });
    }
  };