# EventCore API

EventCore is a modular Express REST API for virtual event management. It provides JWT authentication, organizer-owned event management, participant registration, and Gmail SMTP notifications backed by in-memory data structures.

## Quick Start

Requirements:

- Node.js 20 or newer
- npm

```bash
npm install
cp .env.sample .env
npm run dev
```

The API runs at `http://localhost:3000` by default.

Run the tests with:

```bash
npm test
npm run lint
```

## Documentation

- [API documentation and setup guide](docs/README.md)
- [Postman collection](docs/eventcore-api.postman_collection.json)

The documentation guide covers environment variables, Gmail App Password setup, authentication, authorization, event workflows, error responses, email throttling, and the recommended Postman request order.

## Project Structure

```text
src/
├── config/           Environment configuration
├── controllers/      HTTP request and response handling
├── data/             In-memory data store
├── middleware/       Authentication, authorization, and validation
├── repositories/     In-memory data access
├── routes/           REST endpoint definitions
├── services/         Business logic and Gmail integration
└── utils/            Shared application utilities
tests/                Jest and Supertest coverage
docs/                 API guide and Postman collection
```

Data is process-local and resets whenever the server restarts.
