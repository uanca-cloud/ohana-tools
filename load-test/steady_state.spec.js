const {ENVIRONMENTS, FIXTURE_SETTINGS} = require('../constants.js'),
    {
        importJsonFile
    } = require('./helpers/testHelper.js'),
    {
        createAndCommitUpdate,
        markUpdatesAsRead
    } = require('./helpers/operationsHelper.js'),
    {getRandomInRange} = require('./helpers/plainHelper.js'),
    {group, sleep} = require('k6'),
    {
        createCaregiverSession,
        getFmEncounterUpdates,
        loginFamilyMember,
        getPatientList,
        getPatientDetails
    } = require('./operations.js'),
    {assert, createTrend, verify} = require('./helpers/metricHelper.js'),
    {Counter, Rate} = require('k6/metrics');

const environment = ENVIRONMENTS[__ENV.env ? __ENV.env.toUpperCase() : 'HOTFIX'];

const photo = {
    content: open('./fixtures/caspi.jpg', 'b'),
    name: 'caspi.jpg',
    type: 'image/jpeg'
};

const CG_SESSION_START = 'Caregiver Session Start',
    FM_SESSION_START = 'Family Member Session Start',
    GET_PATIENT_LIST = 'Get patient list',
    FM_ENCOUNTER = 'Family Member Encounter',
    READ_RECEIPTS = 'Read Receipts',
    NUMBER_OF_UPDATES_MARKED_AS_READ = 'Number of updates marked as read',
    NUMBER_OF_UPDATES_SENT = 'Number of updates sent',
    UPDATE_MEDIA_RATE = 'Percentage of updates containing media',
    UPDATE_MULTIPLE_MEDIA_RATE = 'Percentage of updates containing multiple media',
    CREATE_UPDATE = 'Create update',
    ATTACH_MEDIA = 'Attach media',
    QM_ATTACHMENT = 'Quick Message Attachment',
    COMMIT_UPDATE = 'Commit update',
    GET_PATIENT_DETAILS = 'Get patient details';

const createCgSessionTrend = createTrend(CG_SESSION_START),
    createFmSessionTrend = createTrend(FM_SESSION_START),
    getPatientListTrend = createTrend(GET_PATIENT_LIST),
    getFmEncounterTrend = createTrend(FM_ENCOUNTER),
    readReceiptsTrend = createTrend(READ_RECEIPTS),
    createUpdateTrend = createTrend(CREATE_UPDATE),
    attachMediaTrend = createTrend(ATTACH_MEDIA),
    commitUpdateTrend = createTrend(COMMIT_UPDATE),
    getPatientDetailsTrend = createTrend(GET_PATIENT_DETAILS);

const mediaRate = new Rate(UPDATE_MEDIA_RATE),
    multipleMediaRate = new Rate(UPDATE_MULTIPLE_MEDIA_RATE);

const updatesMarkedAsReadCounter = new Counter(NUMBER_OF_UPDATES_MARKED_AS_READ),
    updatesSentCounter = new Counter(NUMBER_OF_UPDATES_SENT);

const totalTenants = FIXTURE_SETTINGS.TENANT_COUNT;
const vuCount = __ENV.vuCount;

const json = importJsonFile(`./fixtures/tenants.json`);

export const options = {
    scenarios: {
        default: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '10m',
            preAllocatedVUs: vuCount,
            stages: [
                {target: Math.floor(vuCount / 4), duration: '15m'},
                {target: Math.floor(vuCount / 2), duration: '35m'},
                {target: Math.floor(vuCount / 4), duration: '5m'},
                {target: 0, duration: '5m'}
            ],
        },
    },
};

module.exports.default = function () {
    const vuId = __VU - 1;
    const tenantIndex = Math.floor(vuId / FIXTURE_SETTINGS.CAREGIVER_COUNT) % totalTenants;
    const caregiverIndex = vuId % FIXTURE_SETTINGS.CAREGIVER_COUNT;
    console.log(caregiverIndex)

    const tenant = json.tenants[tenantIndex];
    const caregiver = tenant.caregivers[caregiverIndex];

    const modifier = getRandomInRange(1, 8);
    const sleepDuration = modifier * Math.ceil(vuId / FIXTURE_SETTINGS.TENANT_COUNT);

    // console.log(`CG: ${caregiver.id}`)

    let cgSessionId;
    let fmSessionId;
    let patients;
    let patient;
    let familyMember;
    let patientDetails;

    //k6 run -e vuCount=1250 steady_state.spec.js ---> 25%
    //k6 run -e vuCount=2500 steady_state.spec.js ---> 50%
    //k6 run -e vuCount=5000 steady_state.spec.js ---> 100%
    //k6 run -e vuCount=10000 steady_state.spec.js ---> 200%

    sleep(sleepDuration);
    group('new caregiver session', () => {
        cgSessionId = createCaregiverSession(environment, createCgSessionTrend, tenant.shortId, caregiver);
        assert(CG_SESSION_START, !!cgSessionId);
    });

    if (cgSessionId) {
        group('get patients list', () => {
            patients = getPatientList(environment, getPatientListTrend, cgSessionId);
            console.log(`Found patients: ${patients.length}`);
            verify(GET_PATIENT_LIST, !!patients.length);
        });
        if (patients.length > 0) {
            group('send update to a patient', () => {
                let updatesCounter;

                const patientIndex = getRandomInRange(0, patients.length - 1);
                patient = patients[patientIndex];

                patientDetails = getPatientDetails(environment, getPatientDetailsTrend, patient.id, cgSessionId);
                assert(GET_PATIENT_DETAILS, !!patientDetails);

                const familyMembers = patientDetails.familyMembers;
                const randomFmIndex = getRandomInRange(0, familyMembers.length - 1);
                familyMember = familyMembers[randomFmIndex];

                // console.log(`FM: ${familyMember.id}`);

                const randomShortTermWeight = Math.random();
                const isShortTermLocation = randomShortTermWeight <= FIXTURE_SETTINGS.PATIENTS_IN_SHORT_TERM_LOCATIONS_WEIGHT;
                if (isShortTermLocation) {
                    updatesCounter = FIXTURE_SETTINGS.UPDATE_COUNT_FOR_SHORT_TERM_LOCATIONS;
                } else {
                    updatesCounter = FIXTURE_SETTINGS.UPDATE_COUNT_FOR_LONG_TERM_LOCATIONS;
                }

                for (let i = 0; i < updatesCounter; i++) {
                    createAndCommitUpdate(environment, {
                            photo,
                            cgSessionId,
                            encounterId: patient.lastEncounterId,
                            patientId: patient.id,
                            sleepDuration,
                            allowMultipleMedia: true
                        },
                        {
                            updatesSentCounter,
                            mediaRate,
                            multipleMediaRate,
                            createUpdateTrend,
                            attachMediaTrend,
                            commitUpdateTrend
                        },
                        {
                            CREATE_UPDATE,
                            ATTACH_MEDIA,
                            QM_ATTACHMENT,
                            COMMIT_UPDATE
                        });
                    sleep(sleepDuration);
                }
            });
        }
    }

    if (familyMember) {
        group('new family member session', () => {
            // console.log('Starting FM session...')
            fmSessionId = loginFamilyMember(environment, createFmSessionTrend, familyMember, familyMember.id);
            // console.log('FM ID:', JSON.stringify(fmSessionId));
            assert(FM_SESSION_START, !!fmSessionId);
        });

        if (fmSessionId) {
            group('read receipts', () => {
                // console.log('Getting updates for FM...')
                const encounterUpdates = getFmEncounterUpdates(environment, getFmEncounterTrend, fmSessionId);
                verify(FM_ENCOUNTER, !!encounterUpdates);

                markUpdatesAsRead(environment,
                    {encounterUpdates, familyMemberDbId: familyMember.id, fmSessionId},
                    {readReceiptsTrend, updatesMarkedAsReadCounter},
                    {READ_RECEIPTS});
            });
        }
    }
}
