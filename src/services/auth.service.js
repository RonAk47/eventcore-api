const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/app-error');
const {
    jwtExpiresIn,
    jwtSecret,
    organizerRegistrationCode
} = require('../config/env');

const passwordRounds = 12;
const maxPasswordBytes = 72;

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
}

async function register({
    name,
    email,
    password,
    role = 'attendee',
    registrationCode
} = {}) {
    const normalizedEmail = normalizeEmail(email);

    if (
        typeof name !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !name.trim() ||
        !isValidEmail(normalizedEmail) ||
        !password
    ) {
        throw new AppError(
            400,
            'Name, email, and password are required',
            'INVALID_INPUT'
        );
    }

    if (password.length < 8) {
        throw new AppError(
            400,
            'Password must be at least 8 characters',
            'INVALID_PASSWORD'
        );
    }

    if (Buffer.byteLength(password, 'utf8') > maxPasswordBytes) {
        throw new AppError(
            400,
            'Password must not exceed 72 UTF-8 bytes',
            'INVALID_PASSWORD'
        );
    }

    if (!['attendee', 'organizer'].includes(role)) {
        throw new AppError(
            400,
            'Role must be attendee or organizer',
            'INVALID_ROLE'
        );
    }

    if (userRepository.findByEmail(normalizedEmail)) {
        throw new AppError(409, 'Email is already registered', 'EMAIL_EXISTS');
    }

    if (
        role === 'organizer' &&
        (!organizerRegistrationCode ||
            registrationCode !== organizerRegistrationCode)
    ) {
        throw new AppError(
            403,
            'A valid organizer registration code is required',
            'ORGANIZER_CODE_REQUIRED'
        );
    }

    const passwordHash = await bcrypt.hash(password, passwordRounds);

    // Hashing yields; recheck before the synchronous in-memory insertion.
    if (userRepository.findByEmail(normalizedEmail)) {
        throw new AppError(409, 'Email is already registered', 'EMAIL_EXISTS');
    }

    const user = userRepository.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role
    });

    return publicUser(user);
}

async function login({ email, password } = {}) {
    if (
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        Buffer.byteLength(password, 'utf8') > maxPasswordBytes
    ) {
        throw new AppError(
            401,
            'Invalid email or password',
            'INVALID_CREDENTIALS'
        );
    }

    const user = userRepository.findByEmail(normalizeEmail(email));
    const passwordMatches =
        user && (await bcrypt.compare(password, user.passwordHash));

    if (!user || !passwordMatches) {
        throw new AppError(
            401,
            'Invalid email or password',
            'INVALID_CREDENTIALS'
        );
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
        expiresIn: jwtExpiresIn
    });
    return { token, user: publicUser(user) };
}

module.exports = {
    register,
    login,
    publicUser
};
