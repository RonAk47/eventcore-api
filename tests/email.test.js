const createEmailRateLimiter = require('../src/services/email-rate-limiter');

describe('email rate limiter', () => {
    afterEach(() => jest.useRealTimers());

    it('resets quota on the next UTC day', async () => {
        let clock = Date.parse('2026-10-15T23:59:59Z');
        const limiter = createEmailRateLimiter({ dailyLimit: 1, minIntervalMs: 0, now: () => clock });
        await limiter.schedule(async () => 'sent');
        await expect(limiter.schedule(async () => 'blocked')).rejects.toMatchObject({ code: 'EMAIL_QUOTA_EXCEEDED' });
        clock = Date.parse('2026-10-16T00:00:00Z');
        expect(limiter.getUsage().sentCount).toBe(0);
        await expect(limiter.schedule(async () => 'sent')).resolves.toBe('sent');
        expect(limiter.getUsage().sentCount).toBe(1);
    });

    it('preserves attempt spacing across midnight', async () => {
        jest.useFakeTimers({ now: new Date('2026-10-15T23:59:59.500Z') });
        const limiter = createEmailRateLimiter({ dailyLimit: 2, minIntervalMs: 1000 });
        await limiter.schedule(async () => 'sent');
        await jest.advanceTimersByTimeAsync(500);
        expect(limiter.getUsage().sentCount).toBe(0);
        const task = jest.fn().mockResolvedValue('sent');
        const operation = limiter.schedule(task);
        await jest.advanceTimersByTimeAsync(499);
        expect(task).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        await operation;
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('spaces failed attempts and recovers without consuming their quota', async () => {
        jest.useFakeTimers();
        const limiter = createEmailRateLimiter({ dailyLimit: 1, minIntervalMs: 1000 });
        await expect(limiter.schedule(async () => {
            throw new Error('provider failure');
        })).rejects.toThrow('provider failure');

        const task = jest.fn().mockResolvedValue('sent');
        const operation = limiter.schedule(task);
        await jest.advanceTimersByTimeAsync(999);
        expect(task).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        await expect(operation).resolves.toBe('sent');
        expect(limiter.getUsage().sentCount).toBe(1);
    });

    it('bounds pending work and releases capacity after a failure', async () => {
        const limiter = createEmailRateLimiter({
            dailyLimit: 2, minIntervalMs: 0, maxPending: 1
        });
        let rejectSend;
        const operation = limiter.schedule(() => new Promise((resolve, reject) => {
            rejectSend = reject;
        }));
        const failure = expect(operation).rejects.toThrow('provider failure');
        await Promise.resolve();
        expect(() => limiter.schedule(async () => 'blocked')).toThrow('Email queue is full');
        rejectSend(new Error('provider failure'));
        await failure;
        await expect(limiter.schedule(async () => 'sent')).resolves.toBe('sent');
    });

    it('enforces the daily email limit', async () => {
        const limiter = createEmailRateLimiter({
            dailyLimit: 1,
            minIntervalMs: 0
        });

        await expect(limiter.schedule(async () => 'sent')).resolves.toBe(
            'sent'
        );
        await expect(
            limiter.schedule(async () => 'blocked')
        ).rejects.toMatchObject({
            statusCode: 429,
            code: 'EMAIL_QUOTA_EXCEEDED'
        });
        expect(limiter.getUsage()).toEqual({ sentCount: 1, dailyLimit: 1 });
    });

    it('does not consume quota when the provider fails', async () => {
        const limiter = createEmailRateLimiter({
            dailyLimit: 1,
            minIntervalMs: 0
        });

        await expect(
            limiter.schedule(async () => {
                throw new Error('provider failure');
            })
        ).rejects.toThrow('provider failure');

        await expect(limiter.schedule(async () => 'retry-sent')).resolves.toBe(
            'retry-sent'
        );
        expect(limiter.getUsage()).toEqual({ sentCount: 1, dailyLimit: 1 });
    });
});
