const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');
const authService = require('../services/auth.service');
const AppError = require('../utils/app-error');
const { jwtSecret } = require('../config/env');

function authenticate(req, res, next) {
    const authorization = req.get('authorization');
    const [scheme, token] = authorization ? authorization.split(' ') : [];

    if (scheme !== 'Bearer' || !token) {
        return next(
            new AppError(
                401,
                'Bearer token is required',
                'AUTHENTICATION_REQUIRED'
            )
        );
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        const user = userRepository.findById(payload.sub);

        if (!user) {
            return next(
                new AppError(401, 'User no longer exists', 'INVALID_TOKEN')
            );
        }

        req.user = authService.publicUser(user);
        return next();
    } catch (error) {
        return next(
            new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN')
        );
    }
}

module.exports = authenticate;
