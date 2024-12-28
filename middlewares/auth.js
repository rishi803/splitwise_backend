const jwt = require('jsonwebtoken');
const connection = require('../config/db'); 

const auth = async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      const token = authHeader?.split(' ')[1];
      if (!token) throw new Error();
  
      jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
          return res.status(401).json({ message: 'Token expired' });
        }
        
        const [rows] = await connection.promise().query('SELECT * FROM users WHERE id = ?', [decoded.id]);
        const user = rows[0];
  
        if (!user) throw new Error();
  
        req.user = user;
        req.token = token;
        next();
      });
    } catch (error) {
      res.status(401).json({ message: 'Authentication required' });
    }
  };

module.exports = auth;
