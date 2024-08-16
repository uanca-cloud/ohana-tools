const {Counter, Rate, Trend} = require('k6/metrics'),
    {ERROR_CODES} = require('./constants.js'),
    {check, fail} = require('k6');

const gqlErrorRate = new Rate('gql_error_rate'),
    gqlSuccessRate = new Rate('gql_success_rate');

function buildErrorCounterMap() {
    const counters = new Map();

    ERROR_CODES.forEach(name => {
        counters.set(name, new Counter(name));
    });

    return counters;
}

function createTrend(name) {
    return new Trend(`STEP -- ${name}`, true);
}

function verify(name, condition) {
    const sets = {};
    sets[name] = condition;

    return check(condition, sets);
}

function assert(name, condition) {
    const result = verify(name, condition);
    if(!result) {
        fail(name);
    }
}

module.exports = {
    gqlErrorRate,
    gqlSuccessRate,
    buildErrorCounterMap,
    createTrend,
    verify,
    assert
};