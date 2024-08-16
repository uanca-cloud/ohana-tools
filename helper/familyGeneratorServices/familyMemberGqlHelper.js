const {generateFamilyLink, generateFamilyMember} = require("../../helper"),
    {generateFamilyMemberData} = require("./computeFamilyMemberInformation");

async function generateFamilyMemberViaGql ({ environment, patientId, caregiverSessionId, pfmSessionId, preferredLocale, patientDateOfBirth, patientRelationship }) {
    const authenticatedFamilyMember = {};
    let invitationToken = '';

    if(pfmSessionId) {
        invitationToken = await generateFamilyLink(environment, pfmSessionId, patientId);
    } else {
        invitationToken = await generateFamilyLink(environment, caregiverSessionId, patientId);
    }

    const {familyMember, generatedFamilyMember} = await generateFamilyMemberData(patientDateOfBirth, preferredLocale, patientRelationship);
    const {authenticationResponse, databaseId} = await generateFamilyMember(environment, familyMember, invitationToken, generatedFamilyMember);

    // adds session id of that newly generated fm to the fm object. This will be needed and referenced if sfm are created.
    authenticatedFamilyMember.sessionId = authenticationResponse;
    authenticatedFamilyMember.userId = databaseId;

    return authenticatedFamilyMember;
}

module.exports = {
    generateFamilyMemberViaGql
}
