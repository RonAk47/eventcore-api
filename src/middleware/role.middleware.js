const AppError = require('../utils/app-error');

function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return next(
                new AppError(
                    403,
                    'You do not have permission to access this resource',
                    'FORBIDDEN'
                )
            );
        }

        return next();
    };
}

module.exports = authorizeRoles;
