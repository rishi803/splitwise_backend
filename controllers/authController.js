

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { validateSignup, validateLogin } = require('../utils/validation');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

exports.signup = async (req, res) => {
  try {
  
    const { name, email, password } = req.body;

   

    const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    console.log(req.body);
    if (rows.length) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    await db.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
 
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { error } = validateLogin(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;
    
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(401).json({ message: 'Invalid credentials' });

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    res.json({
      user: { id: user.id, name: user.username, email: user.email },
      accessToken
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, {
      expiresIn: '15m'
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};