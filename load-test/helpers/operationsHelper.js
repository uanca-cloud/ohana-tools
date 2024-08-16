const {
    createAdminSession,
    getLocationsForTenant,
    addLocationsForTenant,
    createCaregiverSession,
    enrollPatient,
    generateFamilyMemberLink,
    registerFamilyMember,
    loginFamilyMember,
    assignCaregiverToPatient,
    endSession,
    createMediaAttachment,
    createUpdate,
    getQMByPatient,
    addQMAttachment,
    commitUpdate,
    markUpdatesAsRead: markUpdatesAsReadOperation,
    updateTenantSettings,
    addAdminQuickMessage,
    getAdminQuickMessages,
    findPatientInformation
} = require('../operations.js');
const {FIXTURE_SETTINGS, FIXTURE_DATA} = require('../../constants.js');
const {verify} = require('./metricHelper.js');
const {sleep} = require('k6');
const {getRandomInRange} = require('./plainHelper.js');

function setupFixtures(environment, json, vuCount) {
    const data = [];
    const tenants = json.tenants;
    const tenantChunkSize = Math.ceil(vuCount / FIXTURE_SETTINGS.TENANT_COUNT);
    const patientChunkSize = Math.ceil(vuCount / FIXTURE_SETTINGS.PATIENT_COUNT);
    const patientsPerTenant = Math.ceil(vuCount / tenantChunkSize);

    for (let i = 0; i < tenantChunkSize; i++) {
        // generate admin user and locations
        const tenant = tenants[i];
        const adminSessionId = createAdminSession(environment, tenant.admin.jwt, tenant.shortId);
        const dbLocations = [];

        updateTenantSettings(environment, adminSessionId);

        const qm = getAdminQuickMessages(environment, adminSessionId);
        if (!qm || qm.length === 0) {
            addAdminQuickMessage(environment, adminSessionId);
        }

        if (!!adminSessionId) {
            const existingLocations = getLocationsForTenant(environment, adminSessionId);

            if (!!existingLocations && existingLocations.length > 0) {
                dbLocations.push(...existingLocations);
            } else {
                const locationsResponse = addLocationsForTenant(environment, adminSessionId, json.locations);

                if (!!locationsResponse) {
                    dbLocations.push(...Object.values(locationsResponse));
                }
            }
        }

        const patients = [];

        for (let patientIndex = 0; patientIndex < patientsPerTenant; patientIndex++) {
            const cgId = patientIndex % FIXTURE_SETTINGS.CAREGIVER_COUNT;
            const assignedCaregivers = getRandomInRange(1, 3);
            const caregivers = tenant.caregivers.slice(cgId, cgId + assignedCaregivers);
            const patientChunkIndex = Math.floor(patientIndex / patientChunkSize);
            const patient = tenant.patients[patientChunkIndex];

            const randomSecondaryFMWeight = Math.random();
            const multipleFMsPerEncounter = randomSecondaryFMWeight <= FIXTURE_SETTINGS.MULTIPLE_FMS_PER_ENCOUNTER_WEIGHT;

            let secondaryFMCount = 0;
            if (multipleFMsPerEncounter) {
                secondaryFMCount = getRandomInRange(1, FIXTURE_SETTINGS.FAMILY_MEMBER_LIMIT_PER_TENANT);
            }
            const randomShortTermWeight = Math.random();
            const isShortTermLocation = randomShortTermWeight <= FIXTURE_SETTINGS.PATIENTS_IN_SHORT_TERM_LOCATIONS_WEIGHT;

            let lastEncounterId, patientId, location;
            const familyMembers = [];

            if (isShortTermLocation) {
                location = dbLocations.find(location => location.label === FIXTURE_DATA.LOCATIONS.OR);
            } else {
                location = dbLocations.find(location => location.label !== FIXTURE_DATA.LOCATIONS.OR);
            }

            caregivers.forEach((caregiver, index) => {
                const caregiverSessionId = createCaregiverSession(environment, null, tenant.shortId, caregiver);
                caregiver.sessionId = caregiverSessionId;

                if (index === 0) {
                    const randomEncountersNo = Math.floor(Math.random() * FIXTURE_SETTINGS.MAX_ENCOUNTERS_PER_USER) + 1;

                    for (let j = 0; j < randomEncountersNo; j++) {
                        const patientExternalId = Date.now();
                        findPatientInformation(environment, caregiver.jwt, patientExternalId, caregiverSessionId);
                        const patientForEncounter = {
                            ...patient,
                            externalId: patientExternalId
                        }
                        const enrollPatientResponse = enrollPatient(environment, null, caregiverSessionId, patientForEncounter, location);
                        if (!!enrollPatientResponse) {
                            lastEncounterId = enrollPatientResponse.lastEncounterId;
                            console.log(`Generated encounter id: ${lastEncounterId}`)
                            patientId = enrollPatientResponse.id;
                        }
                    }
                    // register FMs
                    const invitationToken = generateFamilyMemberLink(environment, null, caregiverSessionId, patientId);

                    if (!!invitationToken) {
                        const primaryFmId = registerFamilyMember(environment, null, {}, invitationToken, caregiverSessionId);
                        familyMembers.push({
                            userId: primaryFmId,
                            signedChallengeString: FIXTURE_DATA.FAMILY_MEMBER.SIGNED_CHALLENGE_STRING,
                            isPrimary: true
                        });

                        if (secondaryFMCount > 0) {
                            const authResponseId = loginFamilyMember(environment, null, {id: primaryFmId}, primaryFmId);
                            for (let fmIndex = 0; fmIndex < secondaryFMCount; fmIndex++) {
                                const invitationToken = generateFamilyMemberLink(environment, null, authResponseId, patientId);
                                if (!!invitationToken) {
                                    const secondaryFmId = registerFamilyMember(environment, null, {}, invitationToken, authResponseId);
                                    familyMembers.push({
                                        userId: secondaryFmId,
                                        signedChallengeString: FIXTURE_DATA.FAMILY_MEMBER.SIGNED_CHALLENGE_STRING,
                                        isPrimary: false
                                    });
                                }
                            }
                        }
                    }
                } else if (!!lastEncounterId && !!patientId) {
                    assignCaregiverToPatient(environment, lastEncounterId, patientId, caregiverSessionId);
                }
            });

            patients.push({
                lastEncounterId,
                patientId,
                caregivers,
                familyMembers,
                isShortTermLocation
            });
            sleep(0.2);
        }

        data.push({
            shortId: tenant.shortId,
            adminSessionId,
            locations: dbLocations,
            patients
        });
    }
    return data;
}

function cleanupFixtures(environment, data) {
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        try {
            endSession(environment, null, item.adminSessionId);
            item.patients.forEach(patient => {
                patient.caregivers.forEach(caregiver => {
                    endSession(environment, null, caregiver.sessionId);
                })
            })
        } catch (error) {
            console.error(`Session end failed: ${error}`)
        }
    }
}

/**
 *
 * @param environment
 * @param params
 * @param metrics
 * @param constants
 */
function createMediaAttachmentForUpdate(environment, params, metrics, constants) {
    const {cgSessionId, createdUpdateId, encounterId, photo} = params;
    const {attachMediaTrend} = metrics;
    const {ATTACH_MEDIA} = constants;
    // console.log('Attaching image to update...')
    const attachMediaResponse = createMediaAttachment(environment, attachMediaTrend, cgSessionId, createdUpdateId, encounterId, photo);
    verify(ATTACH_MEDIA, attachMediaResponse.status === 200);
}

/**
 *
 * @param environment
 * @param params
 * @param metrics
 * @param constants
 * @returns {null}
 */
function createAndCommitUpdate(environment, params, metrics, constants) {
    const {
        photo,
        sleepDuration,
        cgSessionId,
        encounterId,
        patientId = null,
        allowMultipleMedia = false,
        allowQMUpdates = false
    } = params;

    const {
        CREATE_UPDATE,
        ATTACH_MEDIA,
        QM_ATTACHMENT,
        GET_QM_LIST,
        COMMIT_UPDATE
    } = constants;

    const {
        updatesSentCounter,
        mediaRate,
        multipleMediaRate,
        qmRate,
        createUpdateTrend,
        attachMediaTrend,
        commitUpdateTrend,
        qmTrend,
        qmListTrend
    } = metrics;

    const createdUpdateId = createUpdate(environment, createUpdateTrend, cgSessionId, encounterId);
    verify(CREATE_UPDATE, !!createdUpdateId);

    const randomQMWeight = Math.random();
    const sendUpdateWithQM = randomQMWeight <= FIXTURE_SETTINGS.UPDATE_QM_WEIGHT;
    qmRate && qmRate.add(allowQMUpdates && sendUpdateWithQM);

    const randomMediaWeight = Math.random();
    const sendUpdateWithMedia = randomMediaWeight <= FIXTURE_SETTINGS.UPDATE_ATTACH_MEDIA_WEIGHT;
    mediaRate.add(!(allowQMUpdates && sendUpdateWithQM) && sendUpdateWithMedia);

    if (allowQMUpdates && sendUpdateWithQM) {
        const quickMessages = getQMByPatient(environment, qmListTrend, patientId, cgSessionId);
        verify(GET_QM_LIST, !!(quickMessages && quickMessages.length));

        const quickMessageId = quickMessages[0].messageId;
        const addQMAttachmentResponse = addQMAttachment(environment, qmTrend, encounterId, createdUpdateId, quickMessageId, cgSessionId);
        verify(QM_ATTACHMENT, !!addQMAttachmentResponse);
    } else if (sendUpdateWithMedia) {
        const randomMultipleMediaWeight = Math.random();
        const sendWithMultipleMedia = randomMultipleMediaWeight <= FIXTURE_SETTINGS.UPDATE_ATTACH_MULTIPLE_MEDIA_WEIGHT;
        multipleMediaRate.add(allowMultipleMedia && sendWithMultipleMedia);

        let attachmentCount = 1;
        if (allowMultipleMedia && sendWithMultipleMedia) {
            attachmentCount = FIXTURE_SETTINGS.MULTIPLE_ATTACHMENTS_COUNT;
        }

        for (let i = 0; i < attachmentCount; i++) {
            createMediaAttachmentForUpdate(environment,
                {photo, cgSessionId, createdUpdateId, encounterId},
                {attachMediaTrend},
                {ATTACH_MEDIA});
            sleep(sleepDuration);
        }
    }

    const text = 'dummy text';
    const committedUpdateId = commitUpdate(environment, commitUpdateTrend, cgSessionId, encounterId, createdUpdateId, text);
    verify(COMMIT_UPDATE, !!committedUpdateId);
    updatesSentCounter.add(1);
    return committedUpdateId;
}

/**
 *
 * @param environment
 * @param params
 * @param metrics
 * @param constants
 */
function markUpdatesAsRead(environment, params, metrics, constants) {
    const {encounterUpdates, familyMemberDbId, fmSessionId} = params;
    const {readReceiptsTrend, updatesMarkedAsReadCounter} = metrics;
    const {READ_RECEIPTS} = constants;
    const unreadUpdates = encounterUpdates.filter(update => !update.readReceipts.find(readReceipt => readReceipt.user.id === familyMemberDbId));

    if (unreadUpdates.length > 0) {
        // console.log('Reading updates...')
        const readUpdateIds = markUpdatesAsReadOperation(environment, readReceiptsTrend, unreadUpdates.map(update => update.id), fmSessionId);
        verify(READ_RECEIPTS, !!(readUpdateIds && readUpdateIds.length));

        if (!!readUpdateIds && readUpdateIds.length > 0) {
            updatesMarkedAsReadCounter.add(readUpdateIds.length);
        }
    }
}

module.exports = {
    setupFixtures,
    cleanupFixtures,
    createAndCommitUpdate,
    markUpdatesAsRead
};