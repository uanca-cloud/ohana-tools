const {FIXTURE_DATA: {NAMES: {JOHN}, DATES_OF_BIRTH: {MILLENNIAL}}} = require('../constants');

function generateLocationsGqlRequest(locations) {
    const operationName = 'lt_addLocationsForLoadTest';
    const query = `
        mutation ${operationName}(${locations.map((location, index) => `$location${index}: CreateLocationInput!`).join(', ')}) {
            ${locations.map((location, index) => `location${index}: createLocation(location: $location${index}) { id, label }`).join('\n')}
        }
    `;

    const variables = locations.reduce((acc, location, index) => {
        acc[`location${index}`] = {
            label: location.name
        };

        return acc;
    }, {});

    return [operationName, query, variables];
}

function getLocationsGqlRequest() {
    const operationName = 'lt_getLocationsForTenant';
    const query = `
        query ${operationName} {
          locations {
            id
            label
          }
    }`;
    return [operationName, query];
}

function updateTenantSettingsGqlRequest() {
    const operationName = 'lt_updateTenantSetting';
    const query = `
        mutation ${operationName} {
          updateTenantSetting(input: { key: externalIdType, value: "VN" }) {
            key
            value
          }
        }
    `

    return [operationName, query];
}

function getQMGqlRequest() {
    const operationName = 'lt_locationQuickMessages';
    const query = `
        query ${operationName} {
          locationQuickMessages {
            messageId
          }
        }
    `;

    return [operationName, query];
}

function addQMGqlRequest() {
    const operationName = 'lt_createLocationQuickMessage';
    const query = `
        mutation ${operationName} {
          createLocationQuickMessage(
                quickMessages: [
                  { text: "Dummy QM sitewide", locale: "en_US" }
                ]
            ) {
            messageId
          }
        }
    `

    return [operationName, query];
}

function generatePatientsGqlRequest(patients) {
    const operationName = 'lt_enrollPatient';
    const query = `
        mutation ${operationName}(${patients.map((patient, index) => `$patient${index}: EnrollPatientInput!`).join(', ')}) {
            ${patients.map((patient, index) => `patient${index}: enrollPatient(patient: $patient${index}) { id lastEncounterId}`).join('\n')}
        }
    `;

    const variables = patients.reduce((acc, patient, index) => {
        acc[`patient${index}`] = {
            externalId: patient.externalId,
            firstName: JOHN.firstName,
            lastName: JOHN.lastName,
            dateOfBirth: MILLENNIAL,
            location: patient.locationId,
            allowSecondaryFamilyMembers: true
        };

        return acc;
    }, {});

    return [operationName, query, variables];
}

function findPatientInformationGqlRequest(patientId, tenant, token) {
    const operationName = 'lt_findPatientInformation';
    const query = `query ${operationName} {
        findPatientInformation (bearerToken: "${token}", externalId: "${patientId}", externalIdType: "Visit Number") {
            __typename
        }
    }`

    return [operationName, query];
}

function generateCaregiverPatientMappingGqlRequest(mappings) {

    const operationName = 'lt_assignCaregiverToPatient';
    const query = `
    mutation ${operationName}(${mappings.map((_, index) => `$patient${index}: ID!, $encounter${index}: ID!`).join(', ')}) {
        ${mappings.map((_, index) => `mapping${index}: assignCaregiverToPatient(patientId: $patient${index}, encounterId: $encounter${index}) { id }`).join('\n')}
    }`;

    const variables = mappings.reduce((acc, {encounterId, patientId}, index) => {
        acc[`patient${index}`] = patientId;
        acc[`encounter${index}`] = encounterId;

        return acc;
    }, {});

    return [operationName, query, variables];
}

module.exports = {
    generateLocationsGqlRequest,
    generatePatientsGqlRequest,
    generateCaregiverPatientMappingGqlRequest,
    findPatientInformationGqlRequest,
    updateTenantSettingsGqlRequest,
    addQMGqlRequest,
    getQMGqlRequest,
    getLocationsGqlRequest
};
