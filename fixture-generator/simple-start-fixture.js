const argv = require('yargs').argv,
    {readdirSync, appendFileSync} = require('fs'),
    {resolve} = require('path');

const {h: help, dir} = argv;

if (help) {
    console.log(`Usage:    
    node simple-start-fixture --dir=<path_to_fixture_dir>
    `);
    process.exit(0);
}

function generateCaregiverSessionData(caregivers, shortId, newFilePath) {
    caregivers.forEach(caregiver => {
        const data = [caregiver.jwt, shortId, caregiver.device.deviceId, caregiver.device.deviceModel, caregiver.device.osVersion, caregiver.device.appVersion];
        appendFileSync(newFilePath, data.join('|')  + '\n');
    });
}

function generatePatientsData(patients, newFilePath) {
    patients.forEach(patient => {
        const data = [patient.externalId, patient.firstName, patient.lastName, patient.dateOfBirth, patient.locationId];
        appendFileSync(newFilePath, data.join('|')  + '\n');
    });
}

function generateFamilyMembersData(familyMembers, newFilePath) {
    familyMembers.forEach(familyMember => {
        const data = [familyMember.firstName, familyMember.lastName, familyMember.phone, familyMember.locale];
        appendFileSync(newFilePath, data.join('|')  + '\n');
    });
}

const dirPath = resolve(dir);
const files = readdirSync(dirPath);
const jsonFiles = files.filter(file => file.endsWith('.json'));
jsonFiles.forEach((file) => {
    const filePath = `${dirPath}/${file}`;
    const json = require(filePath);
    const caregivers = json.caregivers;
    const patients = json.patients;
    const shortId = json.shortId;
    const familyMembers = json.familyMembers;

    const newFilePath = `../load-test/fixture-data/caregiverSessionData.csv`;
    generateCaregiverSessionData(caregivers, shortId, newFilePath);

    const patientsFilePath = `../load-test/fixture-data/patientsData.csv`;
    generatePatientsData(patients, patientsFilePath);

    const familyMemberFilePath = `../load-test/fixture-data/familyMemberData.csv`;
    generateFamilyMembersData(familyMembers, familyMemberFilePath);
});

