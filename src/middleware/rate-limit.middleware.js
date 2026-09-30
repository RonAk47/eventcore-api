const AppError = require('../utils/app-error');

function createRateLimiter({ limit, windowMs = 15 * 60 * 1000, maxClients = 10000, now = Date.now }) {
    const clients = new Map();

    return (req, res, next) => {
        const timestamp = now();
        for (const [key, entry] of clients) {
            if (entry.resetAt <= timestamp) clients.delete(key);
        }

        const key = req.ip;
        let entry = clients.get(key);
        if (!entry) {
            if (clients.size >= maxClients) {
                res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
                return next(new AppError(429, 'Too many requests', 'RATE_LIMIT_EXCEEDED'));
            }
            entry = { count: 0, resetAt: timestamp + windowMs };
            clients.set(key, entry);
        }

        if (entry.count >= limit) {
            res.set('Retry-After', String(Math.ceil((entry.resetAt - timestamp) / 1000)));
            return next(new AppError(429, 'Too many requests', 'RATE_LIMIT_EXCEEDED'));
        }

        entry.count += 1;
        return next();
    };
}

module.exports = createRateLimiter;
