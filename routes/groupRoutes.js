const express = require('express');
const auth= require('../middlewares/auth');
const router = express.Router();
const groupController = require('../controllers/groupController');

router.use(auth); // to verify login user and adding its detail in request to get details of login user in backend
router.get('/', groupController.getGroups);



module.exports = router;