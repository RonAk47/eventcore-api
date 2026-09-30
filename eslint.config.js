const globals = require('globals');

module.exports = [
    { ignores: ['node_modules/**', 'coverage/**'] },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: globals.node
        },
        rules: {
            'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
            'no-undef': 'error'
        }
    },
    { files: ['tests/**/*.js'], languageOptions: { globals: globals.jest } }
];
