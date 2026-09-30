const express = require('express');
const eventController = require('../controllers/event.controller');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const requireEventOwnership = require('../middleware/ownership.middleware');
const validateBody = require('../middleware/validate.middleware');

const router = express.Router();

router.get('/events', eventController.listEvents);
router.get('/events/:id', eventController.getEvent);
router.get('/me/events', authenticate, eventController.listUserEvents);
router.post(
    '/events',
    authenticate,
    authorizeRoles('organizer'),
    validateBody(['title', 'date', 'time', 'description']),
    eventController.createEvent
);
router.put(
    '/events/:id',
    authenticate,
    authorizeRoles('organizer'),
    requireEventOwnership,
    validateBody(['title', 'date', 'time', 'description']),
    eventController.updateEvent
);
router.delete(
    '/events/:id',
    authenticate,
    authorizeRoles('organizer'),
    requireEventOwnership,
    eventController.deleteEvent
);
router.post(
    '/events/:id/register',
    authenticate,
    eventController.registerParticipant
);
router.delete(
    '/events/:id/register',
    authenticate,
    eventController.cancelParticipant
);

module.exports = router;
