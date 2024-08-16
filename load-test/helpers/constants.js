const
    HTTP_ERRORS = [
        '504',
        '4xx',
        '5xx'
    ].map(error => `HTTP ERROR -- ${error}`),
    GQL_ERRORS = [
        'UNKNOWN',
        'BAD_USER_INPUT',
        'UNAUTHENTICATED',
        'DB_ERROR',
        'NOT_FOUND',
        'NOT_UNIQUE',
        'SERVICE_ERROR',
        'INVALID_TENANT',
        'FORBIDDEN_TENANT',
        'TIMEOUT_ERROR',
        'UNSUPPORTED_VERSION_ERROR',
        'VALIDATION_ERROR',
        'VERSION_MISMATCH',
        'crash.error',
        'crash.exit',
        'parse.illegalCharacters',
        'parse.syntaxError',
        'resolver.unknown',
        'resolver.crash',
        'access.read',
        'access_write',
        'validation.size.tooShort',
        'validation.size.tooLong',
        'validation.count.tooFew',
        'validation.count.tooMany',
        'validation.format',
        'validation.invalidChoice',
        'validation.required',
        'integrity.nonUnique',
        'integrity.collision',
        'entity.notFound',
        'resource.unavailable'
    ].map(error => `GQL ERROR -- ${error}`);

module.exports.ERROR_CODES = [
    ...HTTP_ERRORS,
    ...GQL_ERRORS
];
