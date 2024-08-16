const {group, sleep} = require('k6'),
    {getRandomInRange} = require('./helpers/plainHelper.js'),
    {createCaregiverSession, endSession, getPatientList} = require('./operations.js'),
    {assert, createTrend, verify} = require('./helpers/metricHelper.js'),
    {importJsonFile} = require('./helpers/testHelper.js'),
    {Counter} = require('k6/metrics'),
    {
        ENVIRONMENTS,
        FIXTURE_SETTINGS
    } = require('../constants.js');

const startShiftCreateSessionCounter = new Counter('start_shift_create_session'),
    startShiftGetPatientsCounter = new Counter('start_shift_get_patients'),
    startShiftEndSessionCounter = new Counter('start_shift_end_session'),
    endShiftCreateSessionCounter = new Counter('end_shift_create_session'),
    endShiftGetPatientsCounter = new Counter('end_shift_get_patients');

const SESSION_START = 'Session start',
    GET_PATIENT_LIST = 'Get patient list',
    SESSION_END = 'Session end',
    SESSION_START_END_SHIFT = 'Session start end shift',
    GET_PATIENT_LIST_END_SHIFT = 'Get patient list end shift';

const createSessionTrend = createTrend(SESSION_START),
    getPatientListTrend = createTrend(GET_PATIENT_LIST),
    endSessionTrend = createTrend(SESSION_END),
    createSessionEndShiftTrend = createTrend(SESSION_START_END_SHIFT),
    getPatientListEndShiftTrend = createTrend(GET_PATIENT_LIST_END_SHIFT);

const vuCount = __ENV.vuCount;
if (!vuCount) {
    throw new Error('vuCount required arg!');
}
const environment = ENVIRONMENTS[__ENV.env ? __ENV.env.toUpperCase() : 'HOTFIX'];

const totalTenants = FIXTURE_SETTINGS.TENANT_COUNT;
const tenantChunkSize = Math.ceil(vuCount / totalTenants);

if (__ENV.debug) {
    console.log(`
        Total tenants: ${totalTenants}
        Caregivers per tenant: ${tenantChunkSize}
    `);
}

const rampDownArray = [];
const maxBuckets = Math.ceil(Math.log2(parseInt(vuCount)));
const buckets = maxBuckets > 11 ? 11 : maxBuckets;
const maxRampDownValue = Math.pow(2, buckets);
for (let i = 0; i <= buckets; i++) {
    rampDownArray.push(Math.pow(2, i));
}

const json = importJsonFile(`./fixtures/tenants.json`);
const vuCountShiftLimit = vuCount / 2;
// const durationFirstStage = vuCount > 1200 ? 1200 : vuCount;
// const durationSecondStage = maxRampDownValue > 2048 ? 2048 : maxRampDownValue;

// 1 2 4 8 16 32 64 128 256 512 1024 2048

// vu2100 = 2100 / 5000 = 0.42 weight
// 2048 * 0.42 = 860.16 => 512 - 1023

// vu103 = 103 / 5000 = 0.0206 weight
// 2048 * 0.0206 = 42.188 => 32 - 63

//k6 run -e vuCount=2500 shift_change.spec.js ---> 25%
//k6 run -e vuCount=5000 shift_change.spec.js ---> 50%
//k6 run -e vuCount=10000 shift_change.spec.js ---> 100%
//k6 run -e vuCount=20000 shift_change.spec.js ---> 200%

module.exports.options = {
    vus: vuCount,
    scenarios: {
        start_shift: {
            // executor: 'ramping-vus',
            // startVUs: 0,
            // stages: [
            //     { duration: `${durationFirstStage}s`, target: vuCount },
            //     { duration: `${durationSecondStage}s`, target: vuCount },
            //     { duration: '2m', target: 0 }
            // ],
            // startTime: '0s'
            executor: 'per-vu-iterations',
            vus: vuCount,
            iterations: 1,
            maxDuration: `${vuCount > 2100 ? 2100 : vuCount}s`, //35 mins to run safely per VU
        }
    }
};

// runs once per test run
// module.exports.setup = function () {
//     return {
//         timestamp: Date.now()
//     };
// }

function startShift() {
    const vuId = __VU > vuCountShiftLimit ? __VU - (vuCountShiftLimit + 1) : __VU - 1;
    const tenantIndex = Math.floor(vuId / tenantChunkSize);
    const vuIndex = 0;
    const windowSize = vuCount > 1200 ? 1200 : vuCount;
    const intervalSize = windowSize / vuCount;

    const tenant = json.tenants[tenantIndex];
    if (!tenant) {
        throw new Error(`Cannot find find @ ${tenantIndex} for #${__VU}!`);
    }

    const caregiver = tenant.caregivers[vuIndex];

    group('starting caregiver shift', () => {
        const linearWaitTime = __VU * intervalSize;
        sleep(linearWaitTime);

        const sessionId = createCaregiverSession(environment, createSessionTrend, tenant.shortId, caregiver);
        startShiftCreateSessionCounter.add(1);
        assert(SESSION_START, !!sessionId);

        const randomWaitTime = getRandomInRange(1, 6);
        if (sessionId) {
            sleep(randomWaitTime);
            const patients = getPatientList(environment, getPatientListTrend, sessionId);
            startShiftGetPatientsCounter.add(1);
            verify(GET_PATIENT_LIST, !!patients);
        }

        const weight = __VU / vuCount;
        const computedRampDownValue = weight * maxRampDownValue;
        let rampDownValue = 1;
        for (let i = 0; i < rampDownArray.length; i++) {
            if (rampDownArray[i] < computedRampDownValue && rampDownArray[i + 1] >= computedRampDownValue) {
                rampDownValue = rampDownArray[i]; // changed from i+1 to i to have a smaller wait time
            }
        }

        // const waitTime = ((durationFirstStage * 1000) - (Date.now() - dataForLifecycle.timestamp) + (rampDownValue * 1000)) / 1000;
        const waitTime = rampDownValue > 1200 ? 1200 : rampDownValue;
        console.log(`START SHIFT ${__VU} -- ${vuId} -- ${rampDownValue} -- ${waitTime}`);
        sleep(waitTime + (linearWaitTime / 2));

        if (sessionId) {
            const success = endSession(environment, endSessionTrend, sessionId);
            startShiftEndSessionCounter.add(1);
            verify(SESSION_END, !!success);
        }
    });
}

function endShift() {
    const vuId = __VU > vuCountShiftLimit ? __VU - (vuCountShiftLimit + 1) : __VU - 1;
    const tenantIndex = Math.floor(vuId / tenantChunkSize);
    const vuIndex = 1;
    const windowSize = vuCount > 1200 ? 1200 : vuCount;
    const intervalSize = windowSize / vuCount;

    const tenant = json.tenants[tenantIndex];
    if (!tenant) {
        throw new Error(`Cannot find @ ${tenantIndex} for #${__VU}!`);
    }

    const caregiver = tenant.caregivers[vuIndex];

    group('starting caregiver shift', () => {
        const weight = __VU / vuCount;
        const computedRampDownValue = weight * maxRampDownValue;
        let rampDownValue = 1;
        for (let i = 0; i < rampDownArray.length; i++) {
            if (rampDownArray[i] < computedRampDownValue && rampDownArray[i + 1] >= computedRampDownValue) {
                rampDownValue = rampDownArray[i + 1];
            }
        }

        const linearWaitTime = __VU * intervalSize;

        // const waitTime = (((durationFirstStage * 1000) - (Date.now() - dataForLifecycle.timestamp)) + (rampDownValue * 1000)) / 1000;
        const waitTime = rampDownValue > 1200 ? 1200 : rampDownValue;
        console.log(`END SHIFT ${__VU} -- ${vuId} -- ${rampDownValue} -- ${waitTime}`);
        sleep(waitTime + (linearWaitTime / 2));

        const sessionId = createCaregiverSession(environment, createSessionEndShiftTrend, tenant.shortId, caregiver);
        assert(SESSION_START_END_SHIFT, !!sessionId);
        endShiftCreateSessionCounter.add(1);

        const randomWaitTime = getRandomInRange(1, 6);
        if (sessionId) {
            sleep(randomWaitTime);
            const patients = getPatientList(environment, getPatientListEndShiftTrend, sessionId);
            verify(GET_PATIENT_LIST_END_SHIFT, !!patients);
            endShiftGetPatientsCounter.add(1);
        }
    });
}

module.exports.default = function standard(dataForLifecycle) {
    if (__VU <= vuCountShiftLimit) {
        startShift(dataForLifecycle);
    } else {
        endShift(dataForLifecycle);
    }
}
