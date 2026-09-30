process.env.GMAIL_USER = 'sender@gmail.com';
process.env.GMAIL_APP_PASSWORD = 'test-app-password';
process.env.EMAIL_DAILY_LIMIT = '400';
process.env.EMAIL_MIN_INTERVAL_MS = '0';

jest.mock('nodemailer', () => ({
    createTransport: jest.fn()
}));

const nodemailer = require('nodemailer');
const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-id' });
nodemailer.createTransport.mockReturnValue({ sendMail });
const emailService = require('../src/services/email.service');

describe('Gmail email service', () => {
    beforeEach(() => sendMail.mockClear());

    it('escapes HTML and snapshots event details before queued delivery', async () => {
        const event = {
            title: '<a href="link">Tom & Jane</a>',
            date: '2026-10-15',
            time: '18:00',
            description: "<h1>It's an event</h1>"
        };
        const operation = emailService.sendRegistrationConfirmation({
            recipient: 'attendee@example.com', event
        });
        event.title = 'Changed title';
        event.description = 'Changed description';
        await operation;
        const payload = sendMail.mock.calls[0][0];
        expect(payload.subject).toBe('Registration confirmed: <a href="link">Tom & Jane</a>');
        expect(payload.html).toContain('&lt;a href=&quot;link&quot;&gt;Tom &amp; Jane&lt;/a&gt;');
        expect(payload.html).toContain('&lt;h1&gt;It&#39;s an event&lt;/h1&gt;');
        expect(payload.html).not.toContain('Changed');
    });

    it('returns immediately and catches background delivery failures', async () => {
        let rejectSend;
        sendMail.mockImplementationOnce(() => new Promise((resolve, reject) => {
            rejectSend = reject;
        }));
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(emailService.enqueueRegistrationConfirmation({
                recipient: 'attendee@example.com',
                event: { title: 'Event', date: '2026-10-15', time: '18:00', description: 'Details' }
            })).toBeUndefined();
            await new Promise(setImmediate);
            expect(sendMail).toHaveBeenCalledTimes(1);
            rejectSend(new Error('SMTP failed'));
            await new Promise(setImmediate);
            expect(log).toHaveBeenCalledWith(
                'Registration email delivery failed',
                expect.objectContaining({ code: 'EMAIL_PROVIDER_ERROR' })
            );
        } finally {
            log.mockRestore();
        }
    });

    it('sends a registration confirmation through Gmail SMTP', async () => {
        await expect(
            emailService.sendRegistrationConfirmation({
                recipient: 'attendee@example.com',
                event: {
                    title: 'JavaScript Workshop',
                    date: '2026-10-15',
                    time: '18:00',
                    description: 'An introductory workshop'
                }
            })
        ).resolves.toEqual({ messageId: 'message-id' });

        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'sender@gmail.com',
                to: 'attendee@example.com',
                subject: 'Registration confirmed: JavaScript Workshop',
                html: expect.stringContaining('JavaScript Workshop')
            })
        );
    });
});
