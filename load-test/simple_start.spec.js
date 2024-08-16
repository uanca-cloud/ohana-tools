const {group, sleep} = require('k6'),
    {importJsonFile} = require('./helpers/testHelper.js'),
    {getRandomInRange} = require('./helpers/plainHelper.js'),
    {createCaregiverSession, endSession, getPatientList} = require('./operations.js'),
    {assert, createTrend, verify} = require('./helpers/metricHelper.js'),
    {
        ENVIRONMENTS,
        FIXTURE_SETTINGS
    } = require('../constants.js');

const SESSION_START = 'Session start',
    GET_PATIENT_LIST = 'Get patient list',
    SESSION_END = 'Session end';

const createSessionTrend = createTrend(SESSION_START),
    getPatientListTrend = createTrend(GET_PATIENT_LIST),
    endSessionTrend = createTrend(SESSION_END);

if (!__ENV.vuCount) {
    throw new Error('vuCount required arg!');
}

const totalTenants = FIXTURE_SETTINGS.TENANT_COUNT;
const environment = ENVIRONMENTS[__ENV.env ? __ENV.env.toUpperCase() : 'HOTFIX'];
const vuCount = __ENV.vuCount;

const tenantChunkSize = Math.ceil(vuCount / totalTenants);
const json = importJsonFile(`./fixtures/tenants.json`);

if (__ENV.debug) {
    console.log(`
        Total tenants: ${totalTenants}
        Caregivers per tenant: ${tenantChunkSize}
    `);
}

//k6 run -e vuCount=1312 simple_start.spec.js ---> 25%
//k6 run -e vuCount=2625 simple_start.spec.js ---> 50%
//k6 run -e vuCount=5250 simple_start.spec.js ---> 100%
//k6 run -e vuCount=10500 simple_start.spec.js ---> 200%

module.exports.options = {
    vus: vuCount,
    scenarios: {
        default: {
            executor: 'per-vu-iterations',
            vus: vuCount,
            iterations: 1,
            maxDuration: `${vuCount > 1200 ? 1350 : vuCount}s`, //1200 + 150 to run safely per VU
        }
    },
    thresholds: {
        'iteration_duration{scenario:default}': [`max>=0`],
        'http_req_duration{scenario:default}': [`max>=0`],
        'gql_success_rate{scenario:default}': [],
        'gql_error_rate{scenario:default}': [],
        'http_reqs{scenario:default}': []
    },
    setupTimeout: '30m',
    teardownTimeout: '30m',
};

module.exports.default = function () {
    const vuId = __VU - 1;
    const caregiverIndex = vuId % FIXTURE_SETTINGS.CAREGIVER_COUNT;
    const tenantIndex = Math.floor(vuId % tenantChunkSize);
    const windowSize = vuCount > 1200 ? 1200 : vuCount;
    const intervalSize = windowSize / vuCount;

    const tenant = json.tenants[tenantIndex];
    if (!tenant) {
        throw new Error(`Cannot find find @ ${tenantIndex} for #${__VU}!`);
    }

    const caregiver = tenant.caregivers[caregiverIndex];

    //console.log(`VU #${vuId}: Tenant: ${tenant.shortId}, CG: ${caregiver.firstName} ${caregiver.lastName}`);

    group('new caregiver session', () => {
        const waitTime = __VU * intervalSize;
        console.log(`SLEEP ${__VU} -- ${waitTime}`);
        sleep(waitTime);

        const sessionId = createCaregiverSession(environment, createSessionTrend, tenant.shortId, caregiver);
        assert(SESSION_START, !!sessionId);

        if (sessionId) {
            sleep(getRandomInRange(1, 6));
            const patients = getPatientList(environment, getPatientListTrend, sessionId);
            verify(GET_PATIENT_LIST, !!patients);
        }

        sleep(120);

        if (sessionId) {
            const success = endSession(environment, endSessionTrend, sessionId);
            verify(SESSION_END, !!success);
        }
    });
}
