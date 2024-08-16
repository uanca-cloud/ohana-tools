const {ENVIRONMENTS} = require('../constants.js'),
    {generateFamilyMemberCreationInformation} = require("./familyGeneratorServices/computeFamilyMemberInformation"),
    {generateFamilyMemberViaGql} = require("./familyGeneratorServices/familyMemberGqlHelper");

async function createFamilyMembers (familyMembersData, asPatient) {
    const newGeneratedFamilyMembers = [];
    for(let i = 0; i < familyMembersData.total; i++) {
        const familyMemberProps = {
            environment: familyMembersData.environment,
            caregiverSessionId: familyMembersData.cgSessionId,
            patientId: familyMembersData.patientId,
            patientDOB: familyMembersData.patientDOB
        };

        if (familyMembersData.primaryFamilyMembers.total > i) {
            familyMemberProps.preferredLocale = familyMembersData.primaryFamilyMembers.languageCodes[i];
            familyMemberProps.familyMemberType = 'Primary';

            if (i === 0 && asPatient) {
                familyMemberProps.asPatient = asPatient;
            }

            const primaryFamilyObjectObj = await createFamilyMember(familyMemberProps);
            newGeneratedFamilyMembers.push(primaryFamilyObjectObj);
        } else {
            familyMemberProps.pfmSessionId = newGeneratedFamilyMembers[0].sessionId;
            familyMemberProps.preferredLocale = familyMembersData.secondaryFamilyMembers.languageCodes[(familyMembersData.total - (i+1))];
            familyMemberProps.familyMemberType = 'Secondary';
            const secondaryFamilyObjectObj = await createFamilyMember(familyMemberProps);
            newGeneratedFamilyMembers.push(secondaryFamilyObjectObj);
        }
    }
    return newGeneratedFamilyMembers;
}

async function createFamilyMember ({ environment, pfmSessionId = null, caregiverSessionId, patientId, patientDOB, preferredLocale, familyMemberType, asPatient = false }) {
    const createFamilyMemData = {};

    createFamilyMemData.environment = ENVIRONMENTS[environment ? environment.toUpperCase() : 'LOCAL'];
    createFamilyMemData.patientId = patientId;
    createFamilyMemData.caregiverSessionId = caregiverSessionId;
    createFamilyMemData.pfmSessionId = pfmSessionId;
    createFamilyMemData.preferredLocale = preferredLocale;
    createFamilyMemData.patientDateOfBirth = patientDOB;
    createFamilyMemData.patientRelationship = asPatient ? `Self/Patient` : `Parent`

    const authenticatedFamilyMember = await generateFamilyMemberViaGql(createFamilyMemData);

    // below is important information for table data output
    authenticatedFamilyMember.familyMemberType = familyMemberType;
    authenticatedFamilyMember.preferredLocal = preferredLocale;
    authenticatedFamilyMember.asPatient = asPatient;

    return authenticatedFamilyMember
}

async function generateFamilyMembers (
    environment,
    patientId,
    cgSessionId,
    patientDOB,
    totalFM,
    totalPFM,
    languageCodesPerPFM,
    languageCodesPerSFM,
    asPatient
) {
    const generateFamilyMembersInformation = {
        totalFMs : totalFM,
        totalPFMs: totalPFM,
        languagesPFMs: languageCodesPerPFM,
        languagesSFMs: languageCodesPerSFM,
        patientId: patientId,
        cgSessionId: cgSessionId,
        patientDOB: patientDOB,
        environment: environment
    };
    const familyMembersToCreate = generateFamilyMemberCreationInformation(generateFamilyMembersInformation);

    const newlyCreatedFamilyMembers = await createFamilyMembers(familyMembersToCreate, asPatient);

    console.table(newlyCreatedFamilyMembers);
    return newlyCreatedFamilyMembers;
}

module.exports = {
    generateFamilyMembers
}
