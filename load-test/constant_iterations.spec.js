const {ENVIRONMENTS, FIXTURE_SETTINGS} = require('../constants.js'),
    {
        importJsonFile
    } = require('./helpers/testHelper.js'),
    {
        createAndCommitUpdate,
        markUpdatesAsRead
        } = require('./helpers/operationsHelper.js'),
    {group} = require('k6'),
    {
        createCaregiverSession,
        createAdminSession,
        getFmEncounterUpdates,
        loginFamilyMember,
        getPatientList,
        removeFamilyMember,
        registerFamilyMember,
        generateFamilyMemberLink,
        endSession,
        getPatientDetails,
        updateFamilyMemberDeviceInfo,
        enrollPatient,
        disassociatePatient,
        getLocationsForTenant
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
    CG_SESSION_END = 'Caregiver Session End',
    FM_SESSION_START = 'Family Member Session Start',
    FM_SESSION_END = 'Family Member Session End',
    FM_REMOVE = 'Remove Family Member',
    FM_ADD = 'Add Family Member',
    FM_GENERATE_INVITATION = 'Generate Family Member invitation',
    FM_UPDATE_DEVICE_INFO = 'Update Family Member Device Info',
    ENROLL_PATIENT = "Enroll Patient",
    DISASSOCIATE_PATIENT = "Disassociate Patient",
    GET_PATIENT_LIST = 'Get patient list',
    GET_PATIENT_DETAILS = 'Get patient details',
    FM_ENCOUNTER = 'Family Member Encounter',
    READ_RECEIPTS = 'Read Receipts',
    NUMBER_OF_UPDATES_MARKED_AS_READ = 'Number of updates marked as read',
    NUMBER_OF_UPDATES_SENT = 'Number of updates sent',
    UPDATE_MEDIA_RATE = 'Percentage of updates containing media',
    QM_RATE = 'Percentage of updates containing quick messages',
    UPDATE_MULTIPLE_MEDIA_RATE = 'Percentage of updates containing multiple media',
    CREATE_UPDATE = 'Create update',
    ATTACH_MEDIA = 'Attach media',
    QM_ATTACHMENT = 'Quick Message Attachment',
    GET_QM_LIST = 'Get Quick Messages List',
    COMMIT_UPDATE = 'Commit update';

const createCgSessionTrend = createTrend(CG_SESSION_START),
    cgSessionEndTrend = createTrend(CG_SESSION_END),
    createFmSessionTrend = createTrend(FM_SESSION_START),
    fmSessionEndTrend = createTrend(FM_SESSION_END),
    addFmTrend = createTrend(FM_ADD),
    generateFmInvitationTrend = createTrend(FM_GENERATE_INVITATION),
    fmUpdateDeviceTrend = createTrend(FM_UPDATE_DEVICE_INFO),
    enrollPatientTrend = createTrend(ENROLL_PATIENT),
    disassociatePatientTrend = createTrend(DISASSOCIATE_PATIENT),
    getPatientListTrend = createTrend(GET_PATIENT_LIST),
    getPatientDetailsTrend = createTrend(GET_PATIENT_DETAILS),
    getFmEncounterTrend = createTrend(FM_ENCOUNTER),
    readReceiptsTrend = createTrend(READ_RECEIPTS),
    createUpdateTrend = createTrend(CREATE_UPDATE),
    attachMediaTrend = createTrend(ATTACH_MEDIA),
    commitUpdateTrend = createTrend(COMMIT_UPDATE),
    qmTrend = createTrend(QM_ATTACHMENT),
    qmListTrend = createTrend(GET_QM_LIST);

const mediaRate = new Rate(UPDATE_MEDIA_RATE),
    multipleMediaRate = new Rate(UPDATE_MULTIPLE_MEDIA_RATE),
    qmRate = new Rate(QM_RATE);

const updatesMarkedAsReadCounter = new Counter(NUMBER_OF_UPDATES_MARKED_AS_READ),
    updatesSentCounter = new Counter(NUMBER_OF_UPDATES_SENT);

const totalTenants = FIXTURE_SETTINGS.TENANT_COUNT;

const json = importJsonFile(`./fixtures/tenants.json`);

module.exports.options = {
    scenarios: {
        default: {
            executor: 'constant-arrival-rate',

            // How long the test lasts
            duration: `${__ENV.vuCount * 10}s`,

            // How many iterations per timeUnit
            rate: 1,

            // Start `rate` iterations per second
            timeUnit: '10s',

            // Pre-allocate VUs
            preAllocatedVUs: __ENV.vuCount,
        }
    },
    thresholds: {
        'http_reqs{type:attachMedia}': []
    }
};

module.exports.default = function () {
    const vuId = __VU - 1;
    const tenantIndex = Math.floor(vuId / FIXTURE_SETTINGS.CAREGIVER_COUNT) % totalTenants;
    const caregiverIndex = vuId % FIXTURE_SETTINGS.CAREGIVER_COUNT;

    const tenant = json.tenants[tenantIndex];
    const caregiver = tenant.caregivers[caregiverIndex];

    let cgSessionId;
    let fmSessionId;
    let patients;
    let patient;
    let familyMemberId;
    let patientDetails;

    //k6 run -e vuCount=1250 constant_iterations.spec.js ---> 25%
    //k6 run -e vuCount=2500 constant_iterations.spec.js ---> 50%
    //k6 run -e vuCount=5000 constant_iterations.spec.js ---> 100%
    //k6 run -e vuCount=10000 constant_iterations.spec.js ---> 200%

    group('new caregiver session', () => {
        cgSessionId = createCaregiverSession(environment, createCgSessionTrend, tenant.shortId, caregiver);
        assert(CG_SESSION_START, !!cgSessionId);
    });

    if (cgSessionId) {
        group('get patients list', () => {
            patients = getPatientList(environment, getPatientListTrend, cgSessionId);
            if (!patients || !patients.length) {
                const adminSessionId = createAdminSession(environment, tenant.admin.jwt, tenant.shortId);
                const existingLocations = getLocationsForTenant(environment, adminSessionId);

                if (existingLocations.length > 0) {
                    const location = existingLocations[0];
                    const newPatientData = {
                        externalId: Date.now()
                    }
                    const enrollPatientResponse = enrollPatient(environment, enrollPatientTrend, cgSessionId, newPatientData, location);
                    patients = [enrollPatientResponse];
                    verify(ENROLL_PATIENT, !!enrollPatientResponse);
                }
            }
            assert(GET_PATIENT_LIST, !!patients.length && !!patients[0]);
        });

        group('send update to a patient', () => {
            patient = patients[0];

            patientDetails = getPatientDetails(environment, getPatientDetailsTrend, patient.id, cgSessionId);
            assert(GET_PATIENT_DETAILS, !!patientDetails);

            createAndCommitUpdate(environment,
                {
                    photo,
                    cgSessionId,
                    encounterId: patient.lastEncounterId,
                    patientId: patient.id,
                    sleepDuration: 0,
                    allowQMUpdates: true
                },
                {
                    updatesSentCounter,
                    mediaRate,
                    multipleMediaRate,
                    qmRate,
                    createUpdateTrend,
                    attachMediaTrend,
                    commitUpdateTrend,
                    qmTrend,
                    qmListTrend
                },
                {
                    NUMBER_OF_UPDATES_SENT,
                    CREATE_UPDATE,
                    ATTACH_MEDIA,
                    QM_ATTACHMENT,
                    GET_QM_LIST,
                    COMMIT_UPDATE
                });
        });

        group('remove family member', () => {
            if (patientDetails.familyMembers.length) {
                const removedFM = removeFamilyMember(environment, patientDetails.familyMembers[0].id, cgSessionId);
                verify(FM_REMOVE, !!removedFM);
            }
        });

        group('add new family member', () => {
            const invitationToken = generateFamilyMemberLink(environment, generateFmInvitationTrend, cgSessionId, patient.id)
            familyMemberId = registerFamilyMember(environment, addFmTrend, {}, invitationToken);
            assert(FM_ADD, !!familyMemberId);
        });

        group('disassociate patient', () => {
            const disassociateResponse = disassociatePatient(environment, disassociatePatientTrend, cgSessionId, patient);
            verify(DISASSOCIATE_PATIENT, !!disassociateResponse);
        });

        group('end caregiver session', () => {
            const endSessionResponse = endSession(environment, cgSessionEndTrend, cgSessionId);
            verify(CG_SESSION_END, !!endSessionResponse);
        });
    }

    group('new family member session', () => {
        fmSessionId = loginFamilyMember(environment, createFmSessionTrend, {id: familyMemberId}, familyMemberId);
        assert(FM_SESSION_START, !!fmSessionId);

        const deviceId = updateFamilyMemberDeviceInfo(environment, fmUpdateDeviceTrend, {id: familyMemberId}, fmSessionId);
        verify(FM_UPDATE_DEVICE_INFO, !!deviceId);
    });

    if (fmSessionId) {
        let encounterUpdates;
        group('get updates', () => {
            encounterUpdates = getFmEncounterUpdates(environment, getFmEncounterTrend, fmSessionId);
            verify(FM_ENCOUNTER, !!encounterUpdates);
        });

        group('read receipts', () => {
            markUpdatesAsRead(environment,
                {encounterUpdates, familyMemberDbId: familyMemberId, fmSessionId},
                {readReceiptsTrend, updatesMarkedAsReadCounter},
                {READ_RECEIPTS});
        });

        group('end family member session', () => {
            const endFmSessionResponse = endSession(environment, fmSessionEndTrend, fmSessionId);
            verify(FM_SESSION_END, !!endFmSessionResponse);
        });
    }
}
