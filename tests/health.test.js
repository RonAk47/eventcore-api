const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
    it('returns the service health status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'ok',
            service: 'eventcore-api'
        });
    });

    it('returns a structured error for unknown routes', async () => {
        const response = await request(app).get('/unknown-route');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: {
                code: 'ROUTE_NOT_FOUND',
                message: 'Route not found'
            }
        });
    });
});
