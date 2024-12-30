const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');


router.post('/signup',authController.signup);
router.post('/login',authController.login);


module.exports = router;