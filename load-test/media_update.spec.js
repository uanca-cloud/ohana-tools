const {group} = require('k6'),
    {
        ENVIRONMENTS,
        FIXTURE_SETTINGS
    } = require('../constants.js'),
    {
        createCaregiverSession,
        endSession,
        getPatientList,
        createUpdate,
        commitUpdate,
        createMediaAttachment
    } = require('./operations.js'),
    {importJsonFile} = require('./helpers/testHelper.js'),
    {assert, createTrend, verify} = require('./helpers/metricHelper.js');

const SESSION_START = 'Session start',
    GET_PATIENT_LIST = 'Get patient list',
    CREATE_UPDATE = 'Create update',
    ATTACH_MEDIA = 'Attach media',
    COMMIT_UPDATE = 'Commit update',
    SESSION_END = 'Session end';

const createSessionTrend = createTrend(SESSION_START),
    getPatientListTrend = createTrend(GET_PATIENT_LIST),
    createUpdateTrend = createTrend(CREATE_UPDATE),
    attachMediaTrend = createTrend(ATTACH_MEDIA),
    commitUpdateTrend = createTrend(COMMIT_UPDATE),
    endSessionTrend = createTrend(SESSION_END);

if (!__ENV.vuCount) {
    throw new Error(`'vuCount' required arg!`);
}
const environment = ENVIRONMENTS[__ENV.env ? __ENV.env.toUpperCase() : 'HOTFIX'];
const totalTenants = FIXTURE_SETTINGS.TENANT_COUNT;
const json = importJsonFile(`./fixtures/tenants.json`);

const photo = {
    content: open('./fixtures/caspi.jpg', 'b'),
    name: 'caspi.jpg',
    type: 'image/jpeg'
};
module.exports.options = {
    vus: __ENV.vuCount,
    thresholds: {
        'http_reqs{type:attachMedia}': []
    },
    scenarios: {
        default: {
            executor: 'shared-iterations',
            vus: __ENV.vuCount,
            iterations: Number.parseInt(__ENV.vuCount),
            maxDuration: '690s',
        }
    }
};
module.exports.default = function () {
    const vuId = __VU - 1;
    const tenantIndex = Math.floor(vuId / FIXTURE_SETTINGS.CAREGIVER_COUNT) % totalTenants;
    const caregiverIndex = vuId % FIXTURE_SETTINGS.CAREGIVER_COUNT;

    const tenant = json.tenants[tenantIndex];
    const caregiver = tenant.caregivers[caregiverIndex];

    let sessionId;
    let patients;

    group('new caregiver session', () => {
        sessionId = createCaregiverSession(environment, createSessionTrend, tenant.shortId, caregiver);
        assert(SESSION_START, !!sessionId);
    });
    if (sessionId) {
        group('get patients list', () => {
            patients = getPatientList(environment, getPatientListTrend, sessionId);
            verify(GET_PATIENT_LIST, !!patients);
        });

        group('create & send updates to patients', () => {
            for (let i = 0; i < patients.length; i++) {
                const createdUpdateId = createUpdate(environment, createUpdateTrend, sessionId, patients[i].lastEncounterId);
                verify(CREATE_UPDATE, !!createdUpdateId);

                const attachMediaResponse = createMediaAttachment(environment, attachMediaTrend, sessionId, createdUpdateId, patients[i].lastEncounterId, photo);
                verify(ATTACH_MEDIA, attachMediaResponse.status === 200);

                const commitedUpdateId = commitUpdate(environment, commitUpdateTrend, sessionId, patients[i].lastEncounterId, createdUpdateId);
                verify(COMMIT_UPDATE, !!commitedUpdateId);
            }
        });

        group('end caregiver session', () => {
            const success = endSession(environment, endSessionTrend, sessionId);
            verify(SESSION_END, !!success);
        });
    }
};
