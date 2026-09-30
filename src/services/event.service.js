const eventRepository = require('../repositories/event.repository');
const AppError = require('../utils/app-error');

function validateEventFields({ title, date, time, description }) {
    if (
        typeof title !== 'string' ||
        typeof date !== 'string' ||
        typeof time !== 'string' ||
        typeof description !== 'string' ||
        !title.trim() ||
        !description.trim()
    ) {
        throw new AppError(
            400,
            'Title, date, time, and description are required',
            'INVALID_EVENT'
        );
    }

    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    const isValidDate =
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day;

    if (!isValidDate) {
        throw new AppError(
            400,
            'Date must use YYYY-MM-DD format',
            'INVALID_DATE'
        );
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw new AppError(400, 'Time must use HH:mm format', 'INVALID_TIME');
    }
}

function eventPayload(data) {
    return {
        title: data.title.trim(),
        date: data.date,
        time: data.time,
        description: data.description.trim()
    };
}

function toPublicEvent(event) {
    const { participants, ...publicEvent } = event;

    return {
        ...publicEvent,
        participantCount: participants.length
    };
}

function createEvent(data, organizerId) {
    validateEventFields(data || {});
    return eventRepository.create({ ...eventPayload(data), organizerId });
}

function listEvents() {
    return eventRepository.list();
}

function getEvent(id) {
    const event = eventRepository.findById(id);

    if (!event) {
        throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
    }

    return event;
}

function updateEvent(id, data) {
    getEvent(id);
    validateEventFields(data || {});
    return eventRepository.update(id, eventPayload(data));
}

function deleteEvent(id) {
    getEvent(id);
    eventRepository.remove(id);
}

function registerParticipant(id, userId) {
    getEvent(id);

    if (!eventRepository.addParticipant(id, userId)) {
        throw new AppError(
            409,
            'User is already registered for this event',
            'ALREADY_REGISTERED'
        );
    }

    return getEvent(id);
}

function cancelParticipant(id, userId) {
    getEvent(id);

    if (!eventRepository.removeParticipant(id, userId)) {
        throw new AppError(
            404,
            'User is not registered for this event',
            'REGISTRATION_NOT_FOUND'
        );
    }

    return getEvent(id);
}

function listUserEvents(userId) {
    return eventRepository.findByParticipant(userId);
}

module.exports = {
    createEvent,
    listEvents,
    getEvent,
    updateEvent,
    deleteEvent,
    registerParticipant,
    cancelParticipant,
    listUserEvents,
    toPublicEvent
};
