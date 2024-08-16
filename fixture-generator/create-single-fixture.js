const {
        generateStandaloneTenants,
        generateCaregivers,
        generateStandaloneLocations,
        generatePatients,
        createAdminFixture
    } = require('./fixtures.js'),
    {
        FIXTURE_SETTINGS
    } = require('../constants.js'),
    {mkdirSync, writeFileSync} = require('fs'),
    argv = require('yargs').argv,
    {h: help} = argv;

if (help) {
    console.log(`Usage: node create-single-fixture`);
    process.exit(0);
}

const CAREGIVER_COUNT = FIXTURE_SETTINGS.CAREGIVER_COUNT || 50,
    TENANT_COUNT = FIXTURE_SETTINGS.TENANT_COUNT || 1,
    PATIENT_COUNT = FIXTURE_SETTINGS.PATIENT_COUNT || 10;

console.log(`Generating ${TENANT_COUNT} tenants...`);

const json = {};

json.tenants = generateStandaloneTenants(TENANT_COUNT);
json.locations = generateStandaloneLocations();

json.tenants.forEach(tenant => {
    tenant.admin = createAdminFixture();
    tenant.caregivers = generateCaregivers(CAREGIVER_COUNT);

    const cgForPatient = [];
    const fmForPatient = [];
    tenant.patients = generatePatients(PATIENT_COUNT, tenant, cgForPatient, fmForPatient);
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

const fixturesToExport = JSON.stringify(json, null, 0);

const exportPath = `${dirPath}/tenants.json`;
console.log(`Writing fixture data to disk @ ${exportPath} ...`);
writeFileSync(exportPath, fixturesToExport);

process.exit(0);
