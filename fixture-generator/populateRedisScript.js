const redis = require('redis'),
    {readdirSync, writeFileSync} = require('fs'),
    argv = require('yargs').argv,
    {resolve} = require('path'),
    {ENVIRONMENTS} = require('../constants.js'),
    {promisify} = require("util");

const {e: env, dir} = argv;
const environment = ENVIRONMENTS[env ? env.toUpperCase() : 'HOTFIX'];

function getRedisClient() {
    const connectionString = environment.redisConnectionString;
    const uri = new URL(connectionString);
    const options = {};
    if (uri.protocol === 'rediss:') {
        options.tls = {servername: uri.hostname};
    }

    const client = redis.createClient(connectionString, options);

    return client;
}

const dirPath = resolve(dir);
const files = readdirSync(dirPath);
const jsonFiles = files.filter(file => file.endsWith('.json'));

jsonFiles.forEach(async file => {
    const filePath = `${dirPath}/${file}`;
    const json = require(filePath);
    const familyMembers = json.familyMembers;
    const encounters = json.encounters;
    const patients = json.patients;

    const client = getRedisClient();
    const setAsync = promisify(client.setex).bind(client);
    const redisTTL = 600;
    const FAMILY_INVITES = 'family_invites';

    for (let i = 0; i < familyMembers.length; i++) {
        const familyMemberId = familyMembers[i].id;
        const familyInvitationToken = familyMembers[i].invitationToken;
        let encounter = '';
        for (let j = 0; j < encounters.length; j++) {
            if (encounters[j].familyMembers[0] === familyMemberId) {
                encounter = encounters[j];
                break;
            }
        }
        const encounterDbId = encounter.dbId;
        const tenantId = encounter.tenant;
        let patient = '';
        for (let z = 0; z < patients.length; z++) {
            if (patients[z].id === encounter.patient) {
                patient = patients[z];
                break;
            }
        }
        const patientDbId = patient.dbId;
        const payload = {encounterId: encounterDbId, patientId: patientDbId, tenantId};
        await setAsync(`${FAMILY_INVITES}:${familyInvitationToken}`, redisTTL, JSON.stringify(payload));
        console.log(familyInvitationToken, JSON.stringify(payload));
    }
});

console.log(argv);