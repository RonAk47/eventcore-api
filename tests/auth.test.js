process.env.LOGIN_RATE_LIMIT = '1000';
process.env.REGISTER_RATE_LIMIT = '1000';
const request = require('supertest');
const bcrypt = require('bcryptjs');
const authService = require('../src/services/auth.service');
const app = require('../src/app');
const userRepository = require('../src/repositories/user.repository');
const eventRepository = require('../src/repositories/event.repository');
const authorizeRoles = require('../src/middleware/role.middleware');
const requireEventOwnership = require('../src/middleware/ownership.middleware');
const { resetStore } = require('../src/data/memory.store');

describe('authentication', () => {
    beforeEach(() => {
        resetStore();
    });

    it('registers an attendee with a bcrypt password hash', async () => {
        const response = await request(app).post('/register').send({
            name: 'Jane Doe',
            email: 'JANE@example.com',
            password: 'secure-password'
        });

        expect(response.status).toBe(201);
        expect(response.body.user).not.toHaveProperty('passwordHash');

        const storedUser = userRepository.findByEmail('jane@example.com');
        expect(storedUser.passwordHash).not.toBe('secure-password');
        await expect(
            bcrypt.compare('secure-password', storedUser.passwordHash)
        ).resolves.toBe(true);
    });

    it('creates only one account for concurrent registrations of the same normalized email', async () => {
        const results = await Promise.allSettled(
            ['JANE@example.com', ' jane@example.com '].map((email) =>
                authService.register({
                    name: 'Jane Doe',
                    email,
                    password: 'secure-password'
                })
            )
        );

        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const rejected = results.filter((result) => result.status === 'rejected');

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toMatchObject({
            statusCode: 409,
            code: 'EMAIL_EXISTS'
        });
        expect(userRepository.list()).toHaveLength(1);
        expect(userRepository.list()[0].email).toBe('jane@example.com');
    });

    it.each(['a'.repeat(73), 'é'.repeat(37)])(
        'rejects registration passwords exceeding 72 UTF-8 bytes (%#)',
        async (password) => {
            const response = await request(app).post('/register').send({
                name: 'Jane Doe',
                email: 'jane@example.com',
                password
            });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_PASSWORD');
            expect(userRepository.list()).toHaveLength(0);
        }
    );

    it.each(['a'.repeat(72), 'é'.repeat(36)])(
        'accepts a 72-byte password but rejects login with an appended suffix (%#)',
        async (password) => {
            const registration = await request(app).post('/register').send({
                name: 'Jane Doe',
                email: 'jane@example.com',
                password
            });
            expect(registration.status).toBe(201);

            const login = await request(app).post('/login').send({
                email: 'jane@example.com',
                password
            });
            expect(login.status).toBe(200);

            const suffixedLogin = await request(app).post('/login').send({
                email: 'jane@example.com',
                password: password + 'different'
            });
            expect(suffixedLogin.status).toBe(401);
            expect(suffixedLogin.body.error.code).toBe('INVALID_CREDENTIALS');
        }
    );

    it('requires the organizer registration code', async () => {
        const response = await request(app).post('/register').send({
            name: 'Organizer',
            email: 'organizer@example.com',
            password: 'secure-password',
            role: 'organizer'
        });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('ORGANIZER_CODE_REQUIRED');
    });

    it('rejects malformed email addresses', async () => {
        const response = await request(app).post('/register').send({
            name: 'Jane Doe',
            email: 'not-an-email',
            password: 'secure-password'
        });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('logs in and uses the JWT to access the current user', async () => {
        await request(app).post('/register').send({
            name: 'Jane Doe',
            email: 'jane@example.com',
            password: 'secure-password'
        });

        const loginResponse = await request(app).post('/login').send({
            email: 'JANE@example.com',
            password: 'secure-password'
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.token).toEqual(expect.any(String));
        expect(loginResponse.body.user).not.toHaveProperty('passwordHash');

        const meResponse = await request(app)
            .get('/me')
            .set('Authorization', `Bearer ${loginResponse.body.token}`);

        expect(meResponse.status).toBe(200);
        expect(meResponse.body.user.email).toBe('jane@example.com');
    });

    it('rejects invalid credentials and missing tokens', async () => {
        const loginResponse = await request(app).post('/login').send({
            email: 'missing@example.com',
            password: 'wrong-password'
        });
        const meResponse = await request(app).get('/me');

        expect(loginResponse.status).toBe(401);
        expect(meResponse.status).toBe(401);
    });
});

describe('authorization middleware', () => {
    beforeEach(() => {
        resetStore();
    });

    it('allows only matching roles', () => {
        const next = jest.fn();
        authorizeRoles('organizer')({ user: { role: 'attendee' } }, {}, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ statusCode: 403 })
        );
    });

    it('allows an event owner and rejects another user', () => {
        const owner = userRepository.create({
            id: 'owner-id',
            role: 'organizer'
        });
        const event = eventRepository.create({
            organizerId: owner.id,
            title: 'Event'
        });
        const next = jest.fn();

        requireEventOwnership(
            { params: { id: event.id }, user: owner },
            {},
            next
        );
        expect(next).toHaveBeenCalledWith();

        next.mockClear();
        requireEventOwnership(
            { params: { id: event.id }, user: { id: 'other-id' } },
            {},
            next
        );
        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ statusCode: 403 })
        );
    });
});
