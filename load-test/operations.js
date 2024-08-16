const {generateSessionHeaders, gqlRequest: genericGqlRequest, processResponse} = require('./helpers/gqlHelper.js'),
    {FIXTURE_DATA, OHANA_VERSION} = require('../constants.js'),
    http = require('k6/http'),
    BASE_HEADERS = {'X-Ohana-Version': OHANA_VERSION, 'Content-Type': 'application/json'};

function gqlRequest(environment, operationName, query, variables, headers = {}, tags = {}) {
    return genericGqlRequest(environment.serverEndpointUrl, operationName, query, variables, Object.assign({}, BASE_HEADERS, headers, tags));
}

function createAdminSession(environment, bearerToken, shortTenantId) {
    const query = `
        mutation lt_createAdminSession($bearer: String! $tenant: ID!) { 
            adminCreateOrRefreshSession(bearerToken: $bearer, tenantId: $tenant) { 
                id
            } 
        }
    `;

    const variables = {
        bearer: bearerToken,
        tenant: shortTenantId
    };

    const response = gqlRequest(environment, 'lt_createAdminSession', query, variables);

    const body = response && response.json();
    return body && body.data ? body.data.adminCreateOrRefreshSession.id : null;
}

function addLocationsForTenant(environment, adminSessionId, locations) {
    const query = `
        mutation lt_addLocationsForTenant(${locations.map((location, index) => `$location${index}: CreateLocationInput!`).join(', ')}) {
            ${locations.map((location, index) => `location${index}: createLocation(location: $location${index}) { id, label }`).join('\n')}
        }
    `;

    const variables = locations.reduce((acc, location, index) => {
        acc[`location${index}`] = {
            label: Object.values(FIXTURE_DATA.LOCATIONS)[index]
        };

        return acc;
    }, {});

    const response = gqlRequest(environment, 'lt_addLocationsForTenant', query, variables, generateSessionHeaders(adminSessionId));

    const body = response && response.json();
    return body && body.data ? body.data : null;
}

function getLocationsForTenant(environment, sessionId) {
    const query = `
    query lt_getLocationsForTenant {
      locations {
        id
        label
      }
    }`;
    const response = gqlRequest(environment, 'lt_getLocationsForTenant', query, {}, generateSessionHeaders(sessionId));

    const body = response && response.json();
    return body && body.data ? body.data.locations : null;
}

function removeLocationsForTenant(environment, adminSessionId, locations) {
    if (!locations.length > 0) {
        return null;
    }
    const query = `
        mutation lt_removeLocationsForTenant(${locations.map((location, index) => `$location${index}: ID!`).join(', ')}) {
            ${locations.map((location, index) => `location${index}: removeLocation(id: $location${index})`).join('\n')}
        }
    `;

    const variables = locations.reduce((acc, location, index) => {
        acc[`location${index}`] = location.id;

        return acc;
    }, {});

    const response = gqlRequest(environment, 'lt_removeLocationsForTenant', query, variables, generateSessionHeaders(adminSessionId));

    const body = response && response.json();
    return body && body.data ? body.data : null;
}

function createCaregiverSession(environment, trend, tenant, caregiver) {
    const query = `
        mutation lt_createCaregiverSession($bearer: String! $tenant: ID! $device:DeviceInfoInput!) {
            caregiverCreateOrRefreshSession (bearerToken: $bearer, tenantId: $tenant, device:$device) {
                id
            }
        }
    `;

    const variables = {
        bearer: caregiver.jwt,
        tenant,
        device: {
            deviceId: 'none',
            osVersion: '1',
            deviceModel: 'nodejs',
            appVersion: '1.0.0'
        }
    };

    const response = gqlRequest(environment, 'lt_createCaregiverSession', query, variables);

    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.caregiverCreateOrRefreshSession.id : null;
}

function enrollPatient(environment, trend, caregiverSessionId, patient, location) {
    const query = `
        mutation lt_enrollPatient($externalId: ID!, $firstName: String!, ,$lastName: String!, $dateOfBirth: String!, $location: ID!, $allowSecondaryFamilyMembers: Boolean) {
          enrollPatient(
            patient: {
              externalId: $externalId
              firstName: $firstName
              lastName: $lastName
              dateOfBirth: $dateOfBirth
              location: $location
              allowSecondaryFamilyMembers: $allowSecondaryFamilyMembers
            }
          ) {
            id
            externalId
            externalIdType
            firstName
            lastName
            dateOfBirth
            lastEncounterId
            location {
              id
              label
            }
            lastUpdatedAt
          }
        }
    `;

    const variables = {
        externalId: patient.externalId,
        firstName: FIXTURE_DATA.NAMES.ALICE.firstName,
        lastName: FIXTURE_DATA.NAMES.ALICE.lastName,
        dateOfBirth: '2000-01-01',
        location: location.id,
        allowSecondaryFamilyMembers: true
    };

    const response = gqlRequest(environment, 'lt_enrollPatient', query, variables, generateSessionHeaders(caregiverSessionId));

    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.enrollPatient : null;
}

function disassociatePatient(environment, trend, caregiverSessionId, patient) {
    const query = `
        mutation lt_disassociatePatient($patientId: ID!) {
            disassociatePatient(patientId: $patientId)
        }
    `;

    const variables = {
        patientId: patient.id
    };

    const response = gqlRequest(environment, 'lt_disassociatePatient', query, variables, generateSessionHeaders(caregiverSessionId));

    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.disassociatePatient : null;
}

function assignCaregiverToPatient(environment, encounterId, patientId, caregiverSessionId) {
    const operationName = 'lt_assignCaregiverToPatient';
    const query = `
    mutation lt_assignCaregiverToPatient($patientId: ID!, $encounterId: ID!) {
        assignCaregiverToPatient(patientId: $patientId, encounterId: $encounterId) { id }
    }`;

    const variables = {
        patientId,
        encounterId
    };

    const response = gqlRequest(environment, operationName, query, variables, generateSessionHeaders(caregiverSessionId));
    const body = response && response.json();
    return body && body.data ? body.data.assignCaregiverToPatient : null;
}

function generateFamilyMemberLink(environment, trend, sessionId, patientId) {
    const query = `
        mutation lt_createLink($patientId: ID!){ 
            generateFamilyInvitationUrlByPatient(patientId: $patientId) 
        }
    `;

    const variables = {
        patientId
    };

    const response = gqlRequest(environment, 'lt_createLink', query, variables, generateSessionHeaders(sessionId));
    trend && trend.add(response.timings.waiting);
    const body = response && response.json();
    return body && body.data ? body.data.generateFamilyInvitationUrlByPatient : null;
}

function getPatientDetails(environment, trend, patientId, sessionId) {
    const query = `
        query lt_patient ($patientId: ID!) {
            patient(patientId: $patientId) {
                id
                externalId
                familyMembers {
                    id
                }
            }
        }
    `;

    const response = gqlRequest(environment, 'lt_patient', query, {patientId}, generateSessionHeaders(sessionId), {sessionId});
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.patient : null;
}

function getPatientList(environment, trend, sessionId) {
    const query = `
        query lt_patients {
            patients {
                id
                externalId
                lastEncounterId
                location {
                    id
                }
            }
        }
    `;

    const response = gqlRequest(environment, 'lt_patients', query, {}, generateSessionHeaders(sessionId), {sessionId});
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.patients : null;
}

function createUpdate(environment, trend, sessionId, encounterId) {
    const query = `mutation lt_createUpdate($encounterId: ID!) {
        createUpdate(encounterId: $encounterId) {
          id
        }
      }`;

    const response = gqlRequest(environment, 'lt_createUpdate', query, {encounterId}, generateSessionHeaders(sessionId), {sessionId});
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.createUpdate.id : null;
}

function createMediaAttachment(environment, trend, sessionId, updateId, encounterId, file) {
    const data = {
        body: JSON.stringify({
            encounterId,
            updateId: updateId,
        }),
        attachment: http.file(file.content, file.name, file.type)
    };

    const attachMediaResponse = http.post(environment.attachMediaUrl, data, {
        headers: {
            'Authorization': sessionId,
            'x-ohana-version': OHANA_VERSION
        }, tags: {type: 'attachMedia'}
    });

    trend && trend.add(attachMediaResponse.timings.waiting);
    processResponse(attachMediaResponse);
    return attachMediaResponse;
}

function commitUpdate(environment, trend, sessionId, encounterId, updateId, text = 'test', type = 'media') {
    const query = `mutation lt_commitUpdate($encounterId: ID!, $updateId: ID!, $text: String, $type: String) {
        commitUpdate(input: {encounterId: $encounterId updateId: $updateId text: $text type: $type}) {
          id
        }
    }`;

    const response = gqlRequest(environment, 'lt_commitUpdate', query, {
        encounterId,
        updateId,
        text,
        type
    }, generateSessionHeaders(sessionId), {sessionId});
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.commitUpdate.id : null;
}

function endSession(environment, trend, sessionId) {
    const query = `
        mutation lt_endSession {
            endSession
        }
    `;

    const response = gqlRequest(environment, 'lt_endSession', query, {}, generateSessionHeaders(sessionId), {sessionId});

    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.endSession : null;
}

function registerFamilyMember(environment, trend, familyMember, invitationToken, _sessionId) {
    // need this to set data in redis
    const challengeQuery = `
        query lt_registrationChallenge {
            registrationChallenge(invitationToken: "${invitationToken.split('=')[1]}") { challengeString }
        }
    `;
    gqlRequest(environment, 'lt_registrationChallenge', challengeQuery, {});

    const publicKey = FIXTURE_DATA.FAMILY_MEMBER.PUBLIC_KEY.split('\n')[1] + FIXTURE_DATA.FAMILY_MEMBER.PUBLIC_KEY.split('\n')[2];

    const registrationQuery = `
        mutation lt_registrationResponse {
            registrationResponse(
                invitationToken: "${invitationToken.split('=')[1]}"
                challengeStringSigned: "${FIXTURE_DATA.FAMILY_MEMBER.SIGNED_CHALLENGE_STRING}"
                publicKey: "${publicKey}"
            )
        }`;

    const registrationResponse = gqlRequest(environment, 'lt_registrationResponse', registrationQuery, {});

    trend && trend.add(registrationResponse.timings.waiting);

    const body = registrationResponse && registrationResponse.json();
    return body && body.data ? body.data.registrationResponse : null;
}

function loginFamilyMember(environment, trend, familyMember, userId) {
    const authQuery = `
        query lt_authenticationChallenge {
            authenticationChallenge(userId: "${userId}")
        }
    `;
    const authenticationChallengeRes = gqlRequest(environment, 'lt_authenticationChallenge', authQuery);

    trend && trend.add(authenticationChallengeRes.timings.waiting);

    const authResQuery = `mutation lt_authenticationResponse {
                authenticationResponse(
                    challengeStringSigned: "${FIXTURE_DATA.FAMILY_MEMBER.SIGNED_CHALLENGE_STRING}"
                    userId: "${userId}"
                    device: {
                        deviceId: "${familyMember.id + '_Device'}"
                        deviceModel: "nodejs"
                        osVersion: "1.0",
                        appVersion: "1.0"
                    }
                ) { id }
            }`;

    const authenticationResponse = gqlRequest(environment, 'lt_authenticationResponse', authResQuery);

    trend && trend.add(authenticationResponse.timings.waiting);

    const body = authenticationResponse && authenticationResponse.json();
    return body && body.data ? body.data.authenticationResponse.id : null;
}

function updateFamilyMemberDeviceInfo(environment, trend, familyMember, userId) {
    const query = `mutation lt_updatePushNotificationsConfig {
          updatePushNotificationsConfig (
            config: {
              deviceId: "${familyMember.id + '_Device'}"
              deviceToken: "36dfbc31e9744c9da14a0358e1690171"
              partialKey: "${familyMember.id + '_PK'}"
              notificationPlatform: apns
            }
          ) {
            deviceId
          }
    }`;
    const response = gqlRequest(environment, 'lt_updatePushNotificationsConfig', query, {}, generateSessionHeaders(userId));

    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.updatePushNotificationsConfig.deviceId : null;
}

function removeFamilyMember(environment, userId, sessionId) {
    const query = `
        mutation lt_removeFamilyMember($userId: ID!) {
            removeFamilyMember(userId: $userId)
        }`;

    const variables = {userId};

    const response = gqlRequest(environment, 'lt_removeFamilyMember', query, variables, generateSessionHeaders(sessionId));
    const body = response && response.json();
    return body && body.data ? body.data.removeFamilyMember : null;
}

function getFmEncounterUpdates(environment, trend, familyMemberSessionId) {
    const query = `query lt_familyPatient {
        familyPatient {
          updates {
            id,
            read,
            readReceipts {
                user {
                    id
                }
            }
          }
        }
    }`;
    const response = gqlRequest(environment, 'lt_familyPatient', query, {}, generateSessionHeaders(familyMemberSessionId), {familyMemberSessionId});
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.familyPatient.updates : null;
}

function markUpdatesAsRead(environment, trend, updateIds, familyMemberSessionId) {
    const query = `mutation lt_markUpdateAsRead($updateIds: [ID]) {
        markUpdateAsRead(updateIds: $updateIds) {
            id
        }
    }`;
    const response = gqlRequest(environment, 'lt_markUpdateAsRead', query, {updateIds}, generateSessionHeaders(familyMemberSessionId), {familyMemberSessionId});
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.markUpdateAsRead : null;
}

function getQMByPatient(environment, trend, patientId, sessionId) {
    const query = `
        query lt_quickMessagesByPatient ($patientId: ID!) {
          quickMessagesByPatient(patientId: $patientId) {
            messageId
          }
        }
    `;

    const response = gqlRequest(environment, 'lt_quickMessagesByPatient', query, {patientId}, generateSessionHeaders(sessionId));
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.quickMessagesByPatient : null;
}

function addQMAttachment(environment, trend, encounterId, updateId, quickMessageId, sessionId) {
    const query = `
        mutation lt_addQuickMessageAttachmentOnUpdate (
            $encounterId: ID!
            $updateId: ID!
            $quickMessageId: ID!
        ) {
            addQuickMessageAttachmentOnUpdate(
                input: {
                    encounterId: $encounterId
                    updateId: $updateId
                    quickMessageId: $quickMessageId
                }
            ) {
                    id
            }
        }
    `;

    const response = gqlRequest(environment, 'lt_addQuickMessageAttachmentOnUpdate', query, {encounterId, updateId, quickMessageId}, generateSessionHeaders(sessionId));
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.addQuickMessageAttachmentOnUpdate : null;
}

function createAuditReport(environment, trend, sessionId, startDate, endDate) {
    const query = `mutation lt_createAuditReport ($input: CreateAuditReportInput) {
      createAuditReport(input: $input) {
        name
        status
        id
        statusDate
        startDate
        endDate
      }
    }`;

    const variables = {
        input: {
            startDate,
            endDate
        }
    };

    const response = gqlRequest(environment, 'lt_createAuditReport', query, variables, generateSessionHeaders(sessionId));
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.createAuditReport : null;
}

function auditReportJobs(environment, trend, sessionId) {
    const query = `
    query lt_auditReportJobs {
      auditReportJobs {
        status
        id
      }
    }`;

    const response = gqlRequest(environment, 'lt_auditReportJobs', query, {}, generateSessionHeaders(sessionId));
    trend && trend.add(response.timings.waiting);

    const body = response && response.json();
    return body && body.data ? body.data.auditReportJobs : null;
}

function clientLogs(environment, trend, sessionId, logType, logContent) {
    const params = {
        headers: {
            'Authorization': sessionId,
            'x-ohana-version': OHANA_VERSION,
            'Content-Type': 'text/plain'
        }
    };

    if (logType === 'gzip') {
        params.headers['Content-Encoding'] = 'gzip';
    }

    const clientLogsResponse = http.post(environment.clientLogsUrl, logContent, params);
    trend && trend.add(clientLogsResponse.timings.waiting);
    return clientLogsResponse;
}

function updateTenantSettings(environment, sessionId) {
    const query = `
        mutation lt_updateTenantSetting {
          updateTenantSetting(input: { key: externalIdType, value: "VN" }) {
            key
            value
          }
        }
    `;

    const response = gqlRequest(environment, 'lt_updateTenantSetting', query, {}, generateSessionHeaders(sessionId));

    const body = response && response.json();
    return body && body.data ? body.data.updateTenantSetting : null;
}

function addAdminQuickMessage(environment, sessionId) {
    const query = `
        mutation lt_createLocationQuickMessage {
          createLocationQuickMessage(
                quickMessages: [
                  { text: "Dummy QM sitewide", locale: "en_US" }
                ]
            ) {
            messageId
          }
        }
    `;

    const response = gqlRequest(environment, 'lt_createLocationQuickMessage', query, {}, generateSessionHeaders(sessionId));

    const body = response && response.json();
    return body && body.data ? body.data.createLocationQuickMessage : null;
}

function getAdminQuickMessages(environment, sessionId) {
    const query = `
        query lt_locationQuickMessages {
          locationQuickMessages {
            messageId
          }
        }
    `;

    const response = gqlRequest(environment, 'lt_locationQuickMessages', query, {}, generateSessionHeaders(sessionId));

    const body = response && response.json();
    return body && body.data ? body.data.locationQuickMessages : null;
}

function findPatientInformation(environment, token, patientId, sessionId) {
    const operationName = 'lt_findPatientInformation';
    const query = `query ${operationName} {
        findPatientInformation (bearerToken: "${token}", externalId: "${patientId}", externalIdType: "Visit Number") {
            __typename
        }
    }`

    const response = gqlRequest(environment, operationName, query, {}, generateSessionHeaders(sessionId));

    const body = response && response.json();
    return body && body.data ? body.data.findPatientInformation : null;
}

module.exports = {
    gqlRequest,
    createAdminSession,
    addLocationsForTenant,
    getLocationsForTenant,
    removeLocationsForTenant,
    createCaregiverSession,
    enrollPatient,
    disassociatePatient,
    assignCaregiverToPatient,
    generateFamilyMemberLink,
    getPatientList,
    createUpdate,
    createMediaAttachment,
    commitUpdate,
    endSession,
    registerFamilyMember,
    loginFamilyMember,
    updateFamilyMemberDeviceInfo,
    removeFamilyMember,
    getFmEncounterUpdates,
    markUpdatesAsRead,
    createAuditReport,
    auditReportJobs,
    clientLogs,
    getPatientDetails,
    getQMByPatient,
    addQMAttachment,
    updateTenantSettings,
    addAdminQuickMessage,
    getAdminQuickMessages,
    findPatientInformation
};
