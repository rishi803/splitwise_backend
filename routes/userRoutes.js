const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/search', userController.searchUsers);


module.exports = router;