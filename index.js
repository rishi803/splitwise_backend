const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    console.log(req.cookies); // Access all cookies
    console.log(req.cookies.name); // Access a specific cookie by name
  });

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
})