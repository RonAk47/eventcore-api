const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

function parseInteger(value, fallback) {
    const parsedValue = Number(value ?? fallback);
    return Number.isInteger(parsedValue) ? parsedValue : null;
}

const port = parseInteger(process.env.PORT, 3000);
const nodeEnv = process.env.NODE_ENV || 'development';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
}

const jwtSecret =
    process.env.JWT_SECRET || (nodeEnv === 'test' ? 'test-only-secret' : null);
const emailDailyLimit = parseInteger(process.env.EMAIL_DAILY_LIMIT, 400);
const emailMinIntervalMs = parseInteger(
    process.env.EMAIL_MIN_INTERVAL_MS,
    1000
);

if (!jwtSecret) {
    throw new Error('JWT_SECRET must be configured');
}

const rawJwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1h';
const jwtExpiresIn = /^\d+$/.test(rawJwtExpiresIn)
    ? Number(rawJwtExpiresIn)
    : rawJwtExpiresIn;

try {
    const payload = jwt.decode(jwt.sign({}, jwtSecret, { expiresIn: jwtExpiresIn }));
    if (!Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat) {
        throw new Error('Invalid expiration');
    }
} catch {
    throw new Error('JWT_EXPIRES_IN must be a positive duration of at least one second (for example, 1h or 3600)');
}

const loginRateLimit = parseInteger(process.env.LOGIN_RATE_LIMIT, 20);
const registerRateLimit = parseInteger(process.env.REGISTER_RATE_LIMIT, 10);
for (const [name, value] of Object.entries({ LOGIN_RATE_LIMIT: loginRateLimit, REGISTER_RATE_LIMIT: registerRateLimit })) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer`);
    }
}

if (!Number.isInteger(emailDailyLimit) || emailDailyLimit < 1) {
    throw new Error('EMAIL_DAILY_LIMIT must be a positive integer');
}

if (!Number.isInteger(emailMinIntervalMs) || emailMinIntervalMs < 0) {
    throw new Error('EMAIL_MIN_INTERVAL_MS must be a non-negative integer');
}

module.exports = {
    port,
    jwtSecret,
    jwtExpiresIn,
    loginRateLimit,
    registerRateLimit,
    organizerRegistrationCode: process.env.ORGANIZER_REGISTRATION_CODE || '',
    gmailUser: process.env.GMAIL_USER || '',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
    emailDailyLimit,
    emailMinIntervalMs
};
