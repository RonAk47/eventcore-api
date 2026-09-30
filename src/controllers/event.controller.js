const eventService = require('../services/event.service');
const emailService = require('../services/email.service');

function listEvents(req, res) {
    const events = eventService.listEvents().map(eventService.toPublicEvent);
    return res.status(200).json({ events });
}

function getEvent(req, res, next) {
    try {
        const event = eventService.toPublicEvent(
            eventService.getEvent(req.params.id)
        );
        return res.status(200).json({ event });
    } catch (error) {
        return next(error);
    }
}

function createEvent(req, res, next) {
    try {
        const event = eventService.toPublicEvent(
            eventService.createEvent(req.body, req.user.id)
        );
        return res.status(201).json({ event });
    } catch (error) {
        return next(error);
    }
}

function updateEvent(req, res, next) {
    try {
        const event = eventService.toPublicEvent(
            eventService.updateEvent(req.params.id, req.body)
        );
        return res.status(200).json({ event });
    } catch (error) {
        return next(error);
    }
}

function deleteEvent(req, res, next) {
    try {
        eventService.deleteEvent(req.params.id);
        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
}

function registerParticipant(req, res, next) {
    try {
        const event = eventService.registerParticipant(
            req.params.id,
            req.user.id
        );
        let emailNotification = 'queued';

        try {
            emailService.enqueueRegistrationConfirmation({
                recipient: req.user.email,
                event
            });
        } catch (emailError) {
            emailNotification = 'failed';
            console.error(emailError);
        }

        return res.status(200).json({
            event: eventService.toPublicEvent(event),
            emailNotification
        });
    } catch (error) {
        return next(error);
    }
}

function cancelParticipant(req, res, next) {
    try {
        eventService.cancelParticipant(req.params.id, req.user.id);
        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
}

function listUserEvents(req, res) {
    const events = eventService
        .listUserEvents(req.user.id)
        .map(eventService.toPublicEvent);
    return res.status(200).json({ events });
}

module.exports = {
    listEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    registerParticipant,
    cancelParticipant,
    listUserEvents
};
