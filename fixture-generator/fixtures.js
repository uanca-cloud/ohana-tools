const {padStart, times} = require('lodash'),
    {v4: uuid} = require('uuid'),
    {FIXTURE_DATA: {
        NAMES, LOCATIONS, DEVICES, TITLES, ROLES, PHONES, LOCALES
    }} = require('../constants'),
    {createADUserToken} = require('../helper.js');


function createAdminFixture() {
    const id = uuid();
    return {
        id,
        jwt: createADUserToken({id}, ROLES.ADMIN)
    };
}

function createCaregiverFixture() {
    const id = uuid();
    return {
        id,
        jwt: createADUserToken({id}, ROLES.CAREGIVER)
    };
}
/**
* @typedef {Object} FamilyMember
* @property {string} id
* @property {string|null} publicKey
* @property {string|null} privateKey
* @property {string|null} signedChallengeString
* @return {FamilyMember}
*/
function createFamilyMemberFixture(iteration) {
    return {
        id: `${uuid()}_${iteration}`
    };
}

function createLocationFixture(tenant, id, name) {
    return {
        id: `${tenant.id}_L${id}`,
        caregivers: [],
        patients: [],
        name
    };
}

function createPatientFixture(iteration, tenant, caregivers, familyMembers) {
    const primaryCaregiver = caregivers[0];
    const otherCaregivers = caregivers.slice(1);

    const primaryFM = familyMembers[0];
    const secondaryFMs = familyMembers.slice(1);

    return {
        id: `${tenant.id}_P${iteration}`,
        externalId: uuid(),
        location: '',
        primaryCaregiver: primaryCaregiver?.id,
        otherCaregivers: otherCaregivers.map(caregiver => caregiver.id),
        primaryFamilyMember: primaryFM?.id,
        secondaryFamilyMembers: secondaryFMs.map(secondaryFM => secondaryFM.id)
    };
}

function createEncounterFixture(iteration, tenant, patient) {
    return {
        id: `${tenant.id}_${patient.id}_${iteration}_E`,
        patient: patient.id
    };
}
/**
 * Generate 'count' number of empty tenants
 * @param {Number} count
 * @returns {Array.<{
 * id: String,
 * shortId: String,
 * locations: Array.<{id: String, caregivers: String[], patients: String[]}>,
 * caregivers: Array.<{id: String, jwt: String}>,
 * encounters: Array.<
 * { id: String; patient: String; primaryCaregiver: String; otherCaregivers: String[]; primaryFamilyMember: String; }
 * >,
 * familyMembers: FamilyMember[],
 * patients: Array.<{id: String, externalId: String, location: String}>,
 * admins: Array.<{id: String, jwt: String}>
 * }>}
 */
function generateTenants(count) {
    return times(count).map(iteration => ({
        id: uuid(),
        shortId: `T${padStart(iteration, 4, '0')}`,
        locations: [],
        caregivers: [],
        encounters: [],
        familyMembers: [],
        patients: [],
        admins: []
    }));
}

function generateStandaloneTenants(count) {
    return times(count).map(iteration => ({
        id: uuid(),
        shortId: `T${padStart(iteration, 4, '0')}`
    }));
}

function generateLocations(tenant) {
    return Object.values(LOCATIONS).map((name, index) => createLocationFixture(tenant, index, name));
}

function generateStandaloneLocations() {
    return Object.values(LOCATIONS).map((name, index) => ({id: index, name}));
}

function generateAdmins(count) {
    return times(count).map(_iteration => createAdminFixture());
}

function generateCaregivers(count) {
    return times(count).map(_iteration => createCaregiverFixture());
}

function generateFamilyMembers(count) {
    return times(count).map(iteration => createFamilyMemberFixture(iteration));
}

function generatePatients(count, tenant, caregivers, familyMembers) {
    return times(count).map(iteration => createPatientFixture(iteration, tenant, caregivers, familyMembers));
}

function generateEncounters(tenant, patient, count) {
    return times(count).map(iteration => createEncounterFixture(iteration, tenant, patient));
}

function generateAuditData(tenantId, userId, eventId, startDate, endDate) {
    let location = createLocationFixture({id: tenantId}, 1);
    location = {
        ...location,
        name: LOCATIONS.ICU
    };
    let familyMember = createFamilyMemberFixture(1);
    familyMember = {
        ...familyMember,
        tenant: tenantId,
        firstName: NAMES.ALICE.firstName,
        lastName: NAMES.ALICE.lastName,
        phone: PHONES.DOMESTIC,
        locales: LOCALES.EN_US
    };
    let caregiver = createCaregiverFixture();
    caregiver = {
        ...caregiver,
        tenant: tenantId,
        firstName: NAMES.BOB.firstName,
        lastName: NAMES.BOB.lastName,
        title: TITLES.NURSE,
        roles: [ROLES.CAREGIVER],
        device: {
            deviceId: uuid(),
            osVersion: DEVICES.OS_VERSION,
            deviceModel: DEVICES.DEVICE_MODEL,
            appVersion: DEVICES.APP_VERSION
        }
    };
    let patient = createPatientFixture(1, {id: tenantId}, [caregiver], [familyMember]);
    patient = {
        ...patient,
        firstName: NAMES.JOHN.firstName,
        lastName: NAMES.JOHN.lastName,
        dateOfBirth: '2000-01-01',
        externalIdType: 'MRN'
    };
    let encounter = generateEncounters({id: tenantId}, patient, 1);
    encounter = {
        ...encounter,
        primaryCaregiver: patient.primaryCaregiver,
        otherCaregivers: patient.otherCaregivers,
        primaryFamilyMember: patient.primaryFamilyMember,
        secondaryFamilyMembers: patient.secondaryFamilyMembers
    }

    return {
        tenantId,
        userId,
        eventId,
        createdAt: randomDate(startDate, endDate),
        patient,
        location,
        encounter,
        device: {
            id: '1234', // todo need a real id
            deviceModel: DEVICES.DEVICE_MODEL,
            osVersion: DEVICES.OS_VERSION,
            appVersion: DEVICES.APP_VERSION
        },
        familyLanguage: 'English',
        familyDisplayName: familyMember.firstName + ' ' + familyMember.lastName,
        familyContactNumber: familyMember.phone,
        familyMemberType: 'Primary',
        familyRelation: 'Brother',
        user: {...caregiver, email: NAMES.BOB.email},
        scanStatus: 'New',
        invitationType: 'QR_CODE',
        update: {
            updateContent: {},
            id: '1234' // todo need a real id
        }
    };
}

function randomDate(start, end) {
    const startDate = new Date(start).getTime();
    const endDate = new Date(end).getTime();
    const date = new Date(startDate + Math.random() * (endDate - startDate));
    date.setHours(0);
    return date;
}

module.exports = {
    generateTenants,
    generateStandaloneTenants,
    generateLocations,
    generateAdmins,
    createAdminFixture,
    generateEncounters,
    generateCaregivers,
    generateFamilyMembers,
    generatePatients,
    generateAuditData,
    randomDate,
    generateStandaloneLocations
};
