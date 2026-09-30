process.env.GMAIL_USER = 'sender@example.com';
process.env.GMAIL_APP_PASSWORD = 'test-only-password';
process.env.EMAIL_MIN_INTERVAL_MS = '0';
process.env.EMAIL_DAILY_LIMIT = '400';
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
const nodemailer = require('nodemailer');
const sendMail = jest.fn();
nodemailer.createTransport.mockReturnValue({ sendMail });
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { jwtSecret } = require('../src/config/env');
const users = require('../src/repositories/user.repository');
const events = require('../src/repositories/event.repository');
const { resetStore } = require('../src/data/memory.store');

beforeEach(resetStore);

it('returns while SMTP is pending and retains registration after delivery fails', async () => {
    let rejectSend;
    sendMail.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectSend = reject; }));
    const user = users.create({ email: 'attendee@example.com', role: 'attendee' });
    const event = events.create({ title: 'Event', date: '2026-10-15', time: '18:00', description: 'Details' });
    const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: 60 });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        const response = await request(app).post(`/events/${event.id}/register`)
            .set('Authorization', `Bearer ${token}`).timeout({ response: 1000 });
        expect(response.status).toBe(200);
        expect(response.body.emailNotification).toBe('queued');
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sendMail.mock.calls[0][0].html).toContain('18:00 UTC');
        rejectSend(new Error('SMTP unavailable'));
        await new Promise(setImmediate);
        expect(log).toHaveBeenCalledWith('Registration email delivery failed', expect.objectContaining({ code: 'EMAIL_PROVIDER_ERROR' }));
        expect(events.findById(event.id).participants).toEqual([user.id]);
    } finally {
        log.mockRestore();
    }
});
