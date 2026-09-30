jest.mock('dotenv', () => ({ config: jest.fn() }));

const originalEnv = { ...process.env };
beforeEach(() => {
    jest.resetModules();
    process.env = { NODE_ENV: 'test' };
});
afterEach(() => { process.env = { ...originalEnv }; });

it.each(['invalid', '', '0', '-1h', '500ms', 'Infinity', '999999999999999999999'])('rejects invalid JWT_EXPIRES_IN %s at startup', (value) => {
    process.env.JWT_EXPIRES_IN = value;
    expect(() => require('../src/config/env')).toThrow('JWT_EXPIRES_IN');
});
it.each([['1h', '1h'], ['3600', 3600], ['2 days', '2 days']])('accepts JWT_EXPIRES_IN %s', (value, expected) => {
    process.env.JWT_EXPIRES_IN = value;
    expect(require('../src/config/env').jwtExpiresIn).toBe(expected);
});
it('defaults token lifetime to one hour', () => {
    expect(require('../src/config/env').jwtExpiresIn).toBe('1h');
});
it.each(['LOGIN_RATE_LIMIT', 'REGISTER_RATE_LIMIT'])('validates %s', (name) => {
    process.env[name] = '0';
    expect(() => require('../src/config/env')).toThrow(name);
});
