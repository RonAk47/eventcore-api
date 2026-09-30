const userRepository = require('../src/repositories/user.repository');
const eventRepository = require('../src/repositories/event.repository');
const { resetStore } = require('../src/data/memory.store');

describe('in-memory repositories', () => {
    beforeEach(() => {
        resetStore();
    });

    it('isolates user inputs and all returned user snapshots', () => {
        const input = { email: 'jane@example.com', metadata: { label: 'original' } };
        const created = userRepository.create(input);
        input.metadata.label = 'mutated';
        const id = created.id;
        for (const snapshot of [created, userRepository.findById(id), userRepository.findByEmail(input.email), ...userRepository.list()]) {
            snapshot.email = 'changed@example.com';
            snapshot.metadata.label = 'mutated';
        }
        expect(userRepository.findById(id)).toMatchObject({ email: 'jane@example.com', metadata: { label: 'original' } });
    });

    it('isolates event inputs and snapshots while explicit mutations persist', () => {
        const input = { title: 'Event', metadata: { label: 'original' } };
        const created = eventRepository.create(input);
        input.metadata.label = 'mutated';
        const id = created.id;
        eventRepository.addParticipant(id, 'attendee');
        const update = { metadata: { label: 'updated' } };
        const updated = eventRepository.update(id, update);
        update.metadata.label = 'mutated';
        for (const snapshot of [created, updated, eventRepository.findById(id), ...eventRepository.list(), ...eventRepository.findByParticipant('attendee')]) {
            snapshot.title = 'mutated';
            snapshot.participants.push('intruder');
            snapshot.metadata.label = 'mutated';
        }
        expect(eventRepository.findById(id)).toMatchObject({ title: 'Event', participants: ['attendee'], metadata: { label: 'updated' } });
        expect(eventRepository.removeParticipant(id, 'attendee')).toBe(true);
        expect(eventRepository.findById(id).participants).toEqual([]);
    });

    it('creates and finds users by id and email', () => {
        const user = userRepository.create({
            name: 'Jane Doe',
            email: 'jane@example.com',
            passwordHash: 'hashed-password',
            role: 'attendee'
        });

        expect(userRepository.findById(user.id)).toEqual(user);
        expect(userRepository.findByEmail(user.email)).toEqual(user);
        expect(userRepository.list()).toEqual([user]);
    });

    it('creates, updates, and removes events', () => {
        const event = eventRepository.create({
            title: 'JavaScript Workshop',
            date: '2026-10-15',
            time: '18:00',
            description: 'An introductory workshop',
            organizerId: 'organizer-id'
        });

        expect(event.participants).toEqual([]);
        expect(
            eventRepository.update(event.id, {
                title: 'Advanced JavaScript Workshop'
            })
        ).toMatchObject({
            id: event.id,
            title: 'Advanced JavaScript Workshop'
        });
        expect(eventRepository.findById(event.id).title).toBe(
            'Advanced JavaScript Workshop'
        );
        expect(eventRepository.remove(event.id)).toBe(true);
        expect(eventRepository.findById(event.id)).toBeNull();
    });
});
