const nodemailer = require('nodemailer');
const AppError = require('../utils/app-error');
const createEmailRateLimiter = require('./email-rate-limiter');
const {
    gmailUser,
    gmailAppPassword,
    emailDailyLimit,
    emailMinIntervalMs
} = require('../config/env');

const emailRateLimiter = createEmailRateLimiter({
    dailyLimit: emailDailyLimit,
    minIntervalMs: emailMinIntervalMs
});

const transporter =
    gmailUser && gmailAppPassword
        ? nodemailer.createTransport({
              service: 'gmail',
              auth: {
                  user: gmailUser,
                  pass: gmailAppPassword
              }
          })
        : null;

async function sendGmailEmail(payload) {
    if (!transporter) {
        throw new AppError(
            503,
            'Email service is not configured with Gmail credentials',
            'EMAIL_SERVICE_NOT_CONFIGURED'
        );
    }

    try {
        return await transporter.sendMail({
            from: gmailUser,
            to: payload.recipient,
            subject: payload.subject,
            html: payload.html
        });
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        throw new AppError(
            502,
            'Gmail could not send the message',
            'EMAIL_PROVIDER_ERROR'
        );
    }
}

function escapeHtml(value) {
    const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

function sendRegistrationConfirmation({ recipient, event }) {
    // Construct the message now so later event edits cannot change queued mail.
    const payload = {
        recipient,
        subject: `Registration confirmed: ${event.title}`,
        html: `
                <h2>Registration confirmed</h2>
                <p>You are registered for <strong>${escapeHtml(event.title)}</strong>.</p>
                <p>${escapeHtml(event.date)} at ${escapeHtml(event.time)} UTC</p>
                <p>${escapeHtml(event.description)}</p>
            `
    };
    return emailRateLimiter.schedule(() => sendGmailEmail(payload));
}

function enqueueRegistrationConfirmation(notification) {
    if (!transporter) {
        throw new AppError(
            503,
            'Email service is not configured with Gmail credentials',
            'EMAIL_SERVICE_NOT_CONFIGURED'
        );
    }

    sendRegistrationConfirmation(notification).catch((error) => {
        console.error('Registration email delivery failed', error);
    });
}

module.exports = {
    sendRegistrationConfirmation,
    enqueueRegistrationConfirmation
};
