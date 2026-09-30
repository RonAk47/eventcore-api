const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { jwtSecret } = require('../src/config/env');
const userRepository = require('../src/repositories/user.repository');
const { resetStore } = require('../src/data/memory.store');

beforeEach(resetStore);

it.each(['expired', 'bad-signature', 'malformed', 'missing-user'])('rejects a %s token', async (kind) => {
    const user = userRepository.create({ name: 'User', role: 'attendee' });
    const token = kind === 'malformed' ? 'not-a-token' : jwt.sign(
        { sub: kind === 'missing-user' ? 'missing' : user.id },
        kind === 'bad-signature' ? 'incorrect-secret' : jwtSecret,
        { expiresIn: kind === 'expired' ? -1 : 60 }
    );
    const response = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
});

it('returns a structured error for malformed JSON', async () => {
    const response = await request(app).post('/register').set('Content-Type', 'application/json').send('{"name":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
});

it.each(['24:00', '12:60', '9:30', '18:00Z'])('rejects invalid event time %s', async (time) => {
    const user = userRepository.create({ role: 'organizer' });
    const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: 60 });
    const response = await request(app).post('/events').set('Authorization', `Bearer ${token}`).send({
        title: 'Event', date: '2026-10-15', time, description: 'Details'
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_TIME');
});
