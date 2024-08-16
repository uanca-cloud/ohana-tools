const {DEFAULT_LANGUAGE, FIXTURE_DATA} = require("../../constants");

function generateFamilyMemberCreationInformation ({ totalFMs, totalPFMs, languagesPFMs, languagesSFMs, patientId, cgSessionId, patientDOB, environment }) {
    const familyMembersToGenerate = {
        total: 0,
        patientId: patientId,
        cgSessionId: cgSessionId,
        patientDOB: patientDOB,
        environment: environment,
        primaryFamilyMembers: {
            total: 0,
            languageCodes: []
        },
        secondaryFamilyMembers: {
            total: 0,
            languageCodes: []
        }
    },
        primaryFamilyMembersLangArr = [],
        secondaryFamilyMembersLangArr = [];

    if (totalFMs < totalPFMs || totalFMs <= 0) {
        throw new Error('Total Primary FMs can not be higher then total FMs and total FMs must be at least a total of 1 or greater');
    }

    familyMembersToGenerate.total = totalFMs;
    familyMembersToGenerate.primaryFamilyMembers.total = totalPFMs === 0 ? totalFMs : totalPFMs;
    familyMembersToGenerate.secondaryFamilyMembers.total = totalPFMs === 0 ? 0 : totalFMs - totalPFMs;

    if(Object.keys(languagesPFMs).length > 0) {
        for(let keyPFM of Object.keys(languagesPFMs)) {
            primaryFamilyMembersLangArr.push(...Array(languagesPFMs[keyPFM]).fill(keyPFM));
        }
    } else {
        primaryFamilyMembersLangArr.push(...Array(familyMembersToGenerate.primaryFamilyMembers.total).fill(DEFAULT_LANGUAGE));
    }

    if (primaryFamilyMembersLangArr.length === familyMembersToGenerate.primaryFamilyMembers.total) {
        familyMembersToGenerate.primaryFamilyMembers.languageCodes = primaryFamilyMembersLangArr;
    } else {
        throw new Error('There arent the same amount of languages and total Primary FMs');
    }

    if (familyMembersToGenerate.secondaryFamilyMembers.total > 0) {
        if(Object.keys(languagesSFMs).length > 0) {
            for(let keySFM of Object.keys(languagesSFMs)) {
                secondaryFamilyMembersLangArr.push(...Array(languagesSFMs[keySFM]).fill(keySFM));
            }
        } else {
            secondaryFamilyMembersLangArr.push(...Array(familyMembersToGenerate.secondaryFamilyMembers.total).fill(DEFAULT_LANGUAGE));
        }

        if (secondaryFamilyMembersLangArr.length === familyMembersToGenerate.secondaryFamilyMembers.total) {
            familyMembersToGenerate.secondaryFamilyMembers.languageCodes = secondaryFamilyMembersLangArr;
        } else {
            throw new Error('There arent the same amount of languages and total Secondary FMs');
        }
    }

    return familyMembersToGenerate;
}

async function generateFamilyMemberData (patientDateOfBirth, preferredLocale, patientRelationship) {
    const generatedFamilyMember = {};
    generatedFamilyMember.phoneNumber = Math.floor(Math.random() * 100000000000);
    generatedFamilyMember.preferredLocale = preferredLocale;
    generatedFamilyMember.patientDateOfBirth = patientDateOfBirth;
    generatedFamilyMember.patientRelationship = patientRelationship;
    generatedFamilyMember.firstName = (Math.random() + 1).toString(36).substring(7);
    generatedFamilyMember.lastName = (Math.random() + 1).toString(36).substring(7);
    generatedFamilyMember.id = (Math.random() + 1).toString(36).substring(7);

    const familyMember = {};
    familyMember.publicKey = FIXTURE_DATA.FAMILY_MEMBER.PUBLIC_KEY;
    familyMember.privateKey = FIXTURE_DATA.FAMILY_MEMBER.PRIVATE_KEY;
    familyMember.signedChallengeString = FIXTURE_DATA.FAMILY_MEMBER.SIGNED_CHALLENGE_STRING;
    return {familyMember, generatedFamilyMember};
}

module.exports = {
    generateFamilyMemberCreationInformation,
    generateFamilyMemberData
}
