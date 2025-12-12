module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/**/*.test.js'
    ],
    coverageDirectory: 'coverage',
    verbose: true
};
