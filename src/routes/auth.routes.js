const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth.middleware');
const validateBody = require('../middleware/validate.middleware');
const createRateLimiter = require('../middleware/rate-limit.middleware');
const { loginRateLimit, registerRateLimit } = require('../config/env');

const router = express.Router();

router.post(
    '/register',
    createRateLimiter({ limit: registerRateLimit }),
    validateBody(['name', 'email', 'password']),
    authController.register
);
router.post(
    '/login',
    createRateLimiter({ limit: loginRateLimit }),
    validateBody(['email', 'password']),
    authController.login
);
router.get('/me', authenticate, authController.me);

module.exports = router;
