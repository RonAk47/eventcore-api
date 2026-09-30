const AppError = require('../utils/app-error');

function validateBody(requiredFields) {
    return (req, res, next) => {
        const body = req.body;
        const hasMissingField =
            !body ||
            requiredFields.some(
                (field) =>
                    typeof body[field] !== 'string' || !body[field].trim()
            );

        if (hasMissingField) {
            return next(
                new AppError(
                    400,
                    `Required fields: ${requiredFields.join(', ')}`,
                    'INVALID_REQUEST'
                )
            );
        }

        return next();
    };
}

module.exports = validateBody;
