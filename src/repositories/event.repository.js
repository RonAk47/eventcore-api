const { randomUUID } = require('node:crypto');
const { store } = require('../data/memory.store');

function create(eventData) {
    const event = {
        id: randomUUID(),
        ...structuredClone(eventData),
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    store.events.set(event.id, event);
    return structuredClone(event);
}

function findById(id) {
    return structuredClone(store.events.get(id) || null);
}

function list() {
    return structuredClone([...store.events.values()]);
}

function update(id, eventData) {
    const event = store.events.get(id);

    if (!event) {
        return null;
    }

    Object.assign(event, structuredClone(eventData), { updatedAt: new Date().toISOString() });
    return structuredClone(event);
}

function remove(id) {
    return store.events.delete(id);
}

function addParticipant(id, userId) {
    const event = store.events.get(id);

    if (!event || event.participants.includes(userId)) {
        return false;
    }

    event.participants.push(userId);
    event.updatedAt = new Date().toISOString();
    return true;
}

function removeParticipant(id, userId) {
    const event = store.events.get(id);

    if (!event) {
        return false;
    }

    const participantIndex = event.participants.indexOf(userId);

    if (participantIndex === -1) {
        return false;
    }

    event.participants.splice(participantIndex, 1);
    event.updatedAt = new Date().toISOString();
    return true;
}

function findByParticipant(userId) {
    return list().filter((event) => event.participants.includes(userId));
}

module.exports = {
    create,
    findById,
    list,
    update,
    remove,
    addParticipant,
    removeParticipant,
    findByParticipant
};
