const eventRepository = require('../repositories/event.repository');
const AppError = require('../utils/app-error');

function requireEventOwnership(req, res, next) {
    const event = eventRepository.findById(req.params.id);

    if (!event) {
        return next(new AppError(404, 'Event not found', 'EVENT_NOT_FOUND'));
    }

    if (!req.user || event.organizerId !== req.user.id) {
        return next(
            new AppError(403, 'You do not own this event', 'EVENT_NOT_OWNED')
        );
    }

    return next();
}

module.exports = requireEventOwnership;
