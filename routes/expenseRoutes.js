const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const auth = require('../middlewares/auth');

router.use(auth);
router.post('/', expenseController.addExpense);


module.exports = router;