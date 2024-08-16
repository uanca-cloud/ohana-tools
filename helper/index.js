const yargs = require('yargs'),
    {generateFamilyMembers} = require("./familyGenerator");

yargs.command({
    command: 'generateFamilyMembers',
    describe: 'Generates Family Member Users for OHS with a combination of random data and specified data (such as, number of primary family members vs secondary family members and specific language codes per group.)',
    builder: {
        environment: {
            alias: 'e',
            describe: 'The environment for OHS that generateFamilyMembers should target, currently LOCAL is default. Anther option is HOTFIX.',
            demandOption: false,
            type:'string',
            default: 'LOCAL'
        },
        cgSessionId: {
            describe: 'Session id for registered caregiver.',
            demandOption: true,
            type:'string'
        },
        patientId: {
            describe: 'Id for enrolled patient with registered caregiver session.',
            demandOption: true,
            type:'string'
        },
        patientDOB: {
            describe: 'Date of birth for enrolled patient.',
            demandOption: true,
            type:'string'
        },
        totalFM: {
            describe: 'Total number of family members to generate.',
            demandOption: true,
            type:'number'
        },
        totalPFM: {
            describe: 'Total number of primary family members to generate.',
            demandOption: false,
            type:'number',
            default: 0
        },
        languageCodesPerPFM: {
            describe: 'Language codes to attach to primary family members.',
            demandOption: false,
            type:'object',
            default: {}
        },
        languageCodesPerSFM: {
            describe: 'Language codes to attach to secondary family members.',
            demandOption: false,
            type:'object',
            default: {}
        },
        asPatient: {
            describe: 'Setting the family member relationship as a patient.',
            demandOption: false,
            type:'boolean',
            default: false
        }
    },
    handler: async function (argv) {
        try{
            await generateFamilyMembers(
                argv.environment,
                argv.patientId,
                argv.cgSessionId,
                argv.patientDOB,
                argv.totalFM,
                argv.totalPFM,
                argv.languageCodesPerPFM,
                argv.languageCodesPerSFM,
                argv.asPatient
            );
            console.log("Success");
        } catch (error) {
            console.error(error);
        }
    }
}).strict();

yargs.parse();
