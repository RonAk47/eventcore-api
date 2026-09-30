process.env.LOGIN_RATE_LIMIT = '1000';
process.env.REGISTER_RATE_LIMIT = '1000';
process.env.ORGANIZER_REGISTRATION_CODE =
    process.env.ORGANIZER_REGISTRATION_CODE || 'test-organizer-code';

jest.mock('../src/services/email.service', () => ({
    enqueueRegistrationConfirmation: jest.fn()
}));

const request = require('supertest');
const app = require('../src/app');
const eventRepository = require('../src/repositories/event.repository');
const { resetStore } = require('../src/data/memory.store');
const emailService = require('../src/services/email.service');

const organizerCode = process.env.ORGANIZER_REGISTRATION_CODE;

async function registerAndLogin({ email, role = 'attendee' }) {
    const registration = await request(app)
        .post('/register')
        .send({
            name: role === 'organizer' ? 'Event Organizer' : 'Event Attendee',
            email,
            password: 'secure-password',
            role,
            registrationCode: role === 'organizer' ? organizerCode : undefined
        });

    const login = await request(app).post('/login').send({
        email,
        password: 'secure-password'
    });

    return {
        user: registration.body.user,
        token: login.body.token
    };
}

async function createEvent(token, overrides = {}) {
    return request(app)
        .post('/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
            title: 'JavaScript Workshop',
            date: '2026-10-15',
            time: '18:00',
            description: 'An introductory workshop',
            ...overrides
        });
}

describe('event CRUD', () => {
    beforeEach(() => {
        resetStore();
    });

    it('allows an organizer to create, read, update, and delete an event', async () => {
        const organizer = await registerAndLogin({
            email: 'organizer@example.com',
            role: 'organizer'
        });
        const createResponse = await createEvent(organizer.token);
        const eventId = createResponse.body.event.id;

        const listResponse = await request(app).get('/events');
        const getResponse = await request(app).get(`/events/${eventId}`);
        const updateResponse = await request(app)
            .put(`/events/${eventId}`)
            .set('Authorization', `Bearer ${organizer.token}`)
            .send({
                title: 'Advanced JavaScript Workshop',
                date: '2026-10-16',
                time: '19:30',
                description: 'An advanced workshop'
            });
        const deleteResponse = await request(app)
            .delete(`/events/${eventId}`)
            .set('Authorization', `Bearer ${organizer.token}`);

        expect(createResponse.status).toBe(201);
        expect(listResponse.body.events).toHaveLength(1);
        expect(getResponse.body.event.organizerId).toBe(organizer.user.id);
        expect(updateResponse.body.event.title).toBe(
            'Advanced JavaScript Workshop'
        );
        expect(deleteResponse.status).toBe(204);
        expect(eventRepository.findById(eventId)).toBeNull();
    });

    it('rejects attendees from creating events and other organizers from updating them', async () => {
        const organizer = await registerAndLogin({
            email: 'organizer@example.com',
            role: 'organizer'
        });
        const otherOrganizer = await registerAndLogin({
            email: 'other-organizer@example.com',
            role: 'organizer'
        });
        const attendee = await registerAndLogin({
            email: 'attendee@example.com'
        });
        const createResponse = await createEvent(organizer.token);
        const eventId = createResponse.body.event.id;

        const attendeeCreateResponse = await createEvent(attendee.token);
        const unauthorizedUpdateResponse = await request(app)
            .put(`/events/${eventId}`)
            .set('Authorization', `Bearer ${otherOrganizer.token}`)
            .send({
                title: 'Unauthorized Update',
                date: '2026-10-17',
                time: '10:00',
                description: 'Should not be allowed'
            });

        expect(attendeeCreateResponse.status).toBe(403);
        expect(unauthorizedUpdateResponse.status).toBe(403);
        expect(unauthorizedUpdateResponse.body.error.code).toBe(
            'EVENT_NOT_OWNED'
        );
    });

    it('rejects invalid event dates and missing events', async () => {
        const organizer = await registerAndLogin({
            email: 'organizer@example.com',
            role: 'organizer'
        });
        const invalidResponse = await createEvent(organizer.token, {
            date: '2026-02-31'
        });
        const missingResponse = await request(app).get('/events/missing-event');

        expect(invalidResponse.status).toBe(400);
        expect(invalidResponse.body.error.code).toBe('INVALID_DATE');
        expect(missingResponse.status).toBe(404);
    });
});

describe('participant registration', () => {
    beforeEach(() => {
        resetStore();
        emailService.enqueueRegistrationConfirmation.mockReset();
    });

    it('keeps registration when the notification queue is full', async () => {
        const attendee = await registerAndLogin({ email: 'attendee@example.com' });
        const event = eventRepository.create({ title: 'Event', organizerId: 'owner' });
        emailService.enqueueRegistrationConfirmation.mockImplementationOnce(() => {
            throw new Error('Email queue is full');
        });
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const response = await request(app)
                .post(`/events/${event.id}/register`)
                .set('Authorization', `Bearer ${attendee.token}`);
            expect(response.status).toBe(200);
            expect(response.body.emailNotification).toBe('failed');
            expect(eventRepository.findById(event.id).participants).toEqual([attendee.user.id]);
        } finally {
            log.mockRestore();
        }
    });

    it('responds without waiting for notification delivery', async () => {
        const attendee = await registerAndLogin({ email: 'attendee@example.com' });
        const event = eventRepository.create({ title: 'Event', organizerId: 'owner' });
        emailService.enqueueRegistrationConfirmation.mockReturnValueOnce(new Promise(() => {}));
        const response = await request(app)
            .post(`/events/${event.id}/register`)
            .set('Authorization', `Bearer ${attendee.token}`)
            .timeout({ response: 1000 });
        expect(response.status).toBe(200);
        expect(response.body.emailNotification).toBe('queued');
        expect(eventRepository.findById(event.id).participants).toEqual([attendee.user.id]);
    });

    it('registers, lists, and cancels an attendee without duplicates', async () => {
        const organizer = await registerAndLogin({
            email: 'organizer@example.com',
            role: 'organizer'
        });
        const attendee = await registerAndLogin({
            email: 'attendee@example.com'
        });
        const createResponse = await createEvent(organizer.token);
        const eventId = createResponse.body.event.id;

        const registrationResponse = await request(app)
            .post(`/events/${eventId}/register`)
            .set('Authorization', `Bearer ${attendee.token}`);
        const duplicateResponse = await request(app)
            .post(`/events/${eventId}/register`)
            .set('Authorization', `Bearer ${attendee.token}`);
        const registrationsResponse = await request(app)
            .get('/me/events')
            .set('Authorization', `Bearer ${attendee.token}`);
        const cancellationResponse = await request(app)
            .delete(`/events/${eventId}/register`)
            .set('Authorization', `Bearer ${attendee.token}`);
        const secondCancellationResponse = await request(app)
            .delete(`/events/${eventId}/register`)
            .set('Authorization', `Bearer ${attendee.token}`);

        expect(registrationResponse.status).toBe(200);
        expect(registrationResponse.body.event.participantCount).toBe(1);
        expect(registrationResponse.body.event).not.toHaveProperty(
            'participants'
        );
        expect(registrationResponse.body.emailNotification).toBe('queued');
        expect(emailService.enqueueRegistrationConfirmation).toHaveBeenCalledWith(
            expect.objectContaining({ recipient: attendee.user.email })
        );
        expect(duplicateResponse.status).toBe(409);
        expect(registrationsResponse.body.events).toHaveLength(1);
        expect(cancellationResponse.status).toBe(204);
        expect(secondCancellationResponse.status).toBe(404);
    });
});
