const {
        generateTenants,
        generateCaregivers,
        generateFamilyMembers,
        generateAdmins,
        generateLocations,
        generatePatients,
        generateEncounters
    } = require('./fixtures'),
    {
        FIXTURE_SETTINGS
    } = require('../constants.js'),
    {mkdirSync, writeFileSync} = require('fs'),
    argv = require('yargs').argv,
    {chunk, includes} = require('lodash'),
    {h: help} = argv;

if (help) {
    console.log(`Usage: node create-multiple-fixtures`);
    process.exit(0);
}

const ADMIN_COUNT = FIXTURE_SETTINGS.ADMIN_COUNT || 1,
    CAREGIVER_COUNT = FIXTURE_SETTINGS.CAREGIVER_COUNT || 50,
    TENANT_COUNT = FIXTURE_SETTINGS.TENANT_COUNT || 1,
    PATIENT_COUNT = FIXTURE_SETTINGS.PATIENT_COUNT || 10,
    FM_LIMIT = FIXTURE_SETTINGS.FAMILY_MEMBER_LIMIT_PER_TENANT,
    FAMILY_MEMBER_COUNT = FIXTURE_SETTINGS.FAMILY_MEMBER_COUNT * FM_LIMIT || PATIENT_COUNT,
    LOCATION_COUNT = FIXTURE_SETTINGS.LOCATION_COUNT || 5,
    MAX_ENCOUNTERS_PER_USER = FIXTURE_SETTINGS.MAX_ENCOUNTERS_PER_USER || 1;

console.log(`Generating ${TENANT_COUNT} tenants...`);
const tenants = generateTenants(TENANT_COUNT).map(tenant => {
    //console.log(`Generating locations for ${tenant.id} ...`)
    tenant.locations = generateLocations(tenant, LOCATION_COUNT);

    //console.log(`Generating admin users for ${tenant.id} ...`);
    tenant.admins = generateAdmins(ADMIN_COUNT, tenant);
    //console.log(`Generating caregivers for ${tenant.id}  ...`);
    tenant.caregivers = generateCaregivers(CAREGIVER_COUNT, tenant);

    //console.log(`Distributing caregivers over locations ...`);
    chunk(tenant.caregivers, Math.ceil(tenant.caregivers.length / tenant.locations.length)).forEach((locationCaregivers, index) => {
        tenant.locations[index].caregivers = locationCaregivers.map(caregiver => caregiver.id);
    });

    //console.log(`Generating familyMembers for ${tenant.id} ...`);
    tenant.familyMembers = generateFamilyMembers((FAMILY_MEMBER_COUNT), tenant);

    const cgForPatient = [];
    const fmForPatient = [];

    //console.log(`Generating patients for ${tenant.id} ...`);
    tenant.patients = generatePatients(PATIENT_COUNT, tenant, cgForPatient, fmForPatient);

    //console.log(`Distributing patients over locations for ${tenant.id} ...`);
    chunk(tenant.patients, Math.ceil(tenant.patients.length / tenant.locations.length)).forEach((patientsForLocation, index) => {
        tenant.locations[index].patients = patientsForLocation.map(patient => patient.id);

        patientsForLocation.forEach(patient => {
            patient.location = tenant.locations[index].id;
        });
    });

    const tenantEncounters = [];

    //console.log(`Generating encounters for ${tenant.id} ...`);
    tenant.patients = tenant.patients.map((patient, index) => {
        const location = tenant.locations.find(location => location.id === patient.location);
        const caregivers = tenant.caregivers.filter(caregiver => includes(location.caregivers, caregiver.id));
        const incrementalIndex = index * FM_LIMIT;
        const primaryFM = tenant.familyMembers[incrementalIndex];

        const secondaryFMs = [];
        const randomMultipleFM = Math.random();
        if (randomMultipleFM < FIXTURE_SETTINGS.MULTIPLE_FMS_PER_ENCOUNTER_WEIGHT) {
            const multipleFMCount = Math.floor(Math.random() * FM_LIMIT);
            for (let i = incrementalIndex + 1; i < incrementalIndex + 1 + multipleFMCount; i++) {
                secondaryFMs.push(tenant.familyMembers[i])
            }
        }

        patient.primaryCaregiver = caregivers[0].id;
        patient.otherCaregivers = caregivers.slice(1).map(caregiver => caregiver.id);
        patient.primaryFamilyMember = primaryFM.id;
        patient.secondaryFamilyMembers = secondaryFMs.map(secondaryFM => secondaryFM.id);

        const randomEncountersNo = Math.floor(Math.random() * MAX_ENCOUNTERS_PER_USER) + 1;
        const encounters = generateEncounters(tenant, patient, randomEncountersNo);
        tenantEncounters.push(...encounters);

        return patient;
    });

    tenant.encounters = tenantEncounters;

    console.log(`Generated tenant ${tenant.id}.`);

    return tenant;
});

const tempDirPath = `${__dirname}/../.temp`;
const dirPath = `${tempDirPath}/${Date.now()}_user_fixtures`;
try {
    mkdirSync(tempDirPath);
} catch (error) {
    //do nothing
}

try {
    mkdirSync(dirPath);
} catch (error) {
    //do nothing
}

tenants.forEach((tenant, index) => {
    const fixturesToExport = JSON.stringify(tenant, null, 0);

    const exportPath = `${dirPath}/tenant_${index}.json`;
    console.log(`Writing fixture data to disk @ ${exportPath} ...`);
    writeFileSync(exportPath, fixturesToExport);
});

process.exit(0);
