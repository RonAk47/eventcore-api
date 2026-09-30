const store = {
    users: new Map(),
    events: new Map()
};

function resetStore() {
    store.users.clear();
    store.events.clear();
}

module.exports = {
    store,
    resetStore
};
