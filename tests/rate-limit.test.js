process.env.LOGIN_RATE_LIMIT = '2';
process.env.REGISTER_RATE_LIMIT = '2';
const request = require('supertest');
const app = require('../src/app');
const createRateLimiter = require('../src/middleware/rate-limit.middleware');

it.each(['/login', '/register'])('limits %s attempts and returns Retry-After', async (route) => {
    for (let i = 0; i < 2; i += 1) {
        expect((await request(app).post(route).send({})).status).toBe(400);
    }
    const response = await request(app).post(route)
        .set('X-Forwarded-For', '203.0.113.9').send({});
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
});

it('isolates IPs, bounds client storage, and resets after the window', () => {
    let clock = 0;
    const limit = createRateLimiter({ limit: 1, windowMs: 1000, maxClients: 2, now: () => clock });
    const res = { set: jest.fn() };
    const next = jest.fn();
    const invoke = (ip) => {
        next.mockClear();
        limit({ ip }, res, next);
        return next.mock.calls[0][0];
    };
    expect(invoke('first')).toBeUndefined();
    expect(invoke('first')).toMatchObject({ statusCode: 429 });
    expect(invoke('second')).toBeUndefined();
    expect(invoke('third')).toMatchObject({ statusCode: 429 });
    clock = 1000;
    expect(invoke('third')).toBeUndefined();
    expect(invoke('first')).toBeUndefined();
});
