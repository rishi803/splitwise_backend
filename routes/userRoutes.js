const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/', userController.searchUsers);
router.put('/profile', userController.updateUserProfile);


module.exports = router;