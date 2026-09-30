const { randomUUID } = require('node:crypto');
const { store } = require('../data/memory.store');

function create(userData) {
    const user = {
        id: randomUUID(),
        ...structuredClone(userData),
        createdAt: new Date().toISOString()
    };

    store.users.set(user.id, user);
    return structuredClone(user);
}

function findById(id) {
    return structuredClone(store.users.get(id) || null);
}

function findByEmail(email) {
    for (const user of store.users.values()) {
        if (user.email === email) {
            return structuredClone(user);
        }
    }

    return null;
}

function list() {
    return structuredClone([...store.users.values()]);
}

module.exports = {
    create,
    findById,
    findByEmail,
    list
};
