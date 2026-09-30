const AppError = require('../utils/app-error');

function createEmailRateLimiter({
    dailyLimit,
    minIntervalMs,
    maxPending = 100,
    now = () => Date.now()
}) {
    let day = new Date(now()).toISOString().slice(0, 10);
    let sentCount = 0;
    let lastAttemptFinishedAt = null;
    let pendingCount = 0;
    let queue = Promise.resolve();

    function resetIfNewDay() {
        const currentDay = new Date(now()).toISOString().slice(0, 10);

        if (currentDay !== day) {
            day = currentDay;
            sentCount = 0;
        }
    }

    async function run(task) {
        resetIfNewDay();

        if (sentCount >= dailyLimit) {
            throw new AppError(
                429,
                'Daily email limit has been reached',
                'EMAIL_QUOTA_EXCEEDED'
            );
        }

        const waitTime = lastAttemptFinishedAt === null
            ? 0
            : Math.max(0, minIntervalMs - (now() - lastAttemptFinishedAt));

        if (waitTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        resetIfNewDay();

        if (sentCount >= dailyLimit) {
            throw new AppError(
                429,
                'Daily email limit has been reached',
                'EMAIL_QUOTA_EXCEEDED'
            );
        }

        try {
            const result = await task();
            resetIfNewDay();
            sentCount += 1;
            return result;
        } finally {
            lastAttemptFinishedAt = now();
        }
    }

    function schedule(task) {
        if (pendingCount >= maxPending) {
            throw new AppError(503, 'Email queue is full', 'EMAIL_QUEUE_FULL');
        }

        pendingCount += 1;
        const operation = queue.then(() => run(task)).finally(() => {
            pendingCount -= 1;
        });
        queue = operation.catch(() => undefined);
        return operation;
    }

    function getUsage() {
        resetIfNewDay();
        return { sentCount, dailyLimit };
    }

    return { schedule, getUsage };
}

module.exports = createEmailRateLimiter;
