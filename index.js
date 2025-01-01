const express = require('express');
const cors = require('cors');

require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const expenseRoutes= require('./routes/expenseRoutes');
const groupRoutes = require('./routes/groupRoutes')
const userRoutes= require('./routes/userRoutes');

const cookieParser = require('cookie-parser');

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
})