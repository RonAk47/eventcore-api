const express = require('express');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/event.routes');
const AppError = require('./utils/app-error');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(healthRoutes);
app.use(authRoutes);
app.use(eventRoutes);

app.use((req, res, next) => {
    return next(new AppError(404, 'Route not found', 'ROUTE_NOT_FOUND'));
});

app.use((error, req, res, next) => {
    if (
        error instanceof SyntaxError &&
        error.status === 400 &&
        error.type === 'entity.parse.failed'
    ) {
        return res.status(400).json({
            error: {
                code: 'INVALID_JSON',
                message: 'Invalid JSON payload'
            }
        });
    }

    return next(error);
});

app.use((error, req, res, _next) => {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            error: {
                code: error.code,
                message: error.message
            }
        });
    }

    console.error(error);
    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error'
        }
    });
});

module.exports = app;
