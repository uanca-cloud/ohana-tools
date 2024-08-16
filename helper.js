function log(message) {
    console.log(message);   // eslint-disable-line
}

const {
        OHANA_VERSION
    } = require('./constants.js'),
    jwt = require('jsonwebtoken'),
    {JWT_SIGNING_SECRET, FIXTURE_DATA} = require('./constants');

async function gqlRequest(environment, operationName, query, variables, sessionId) {
    const reqBody = JSON.stringify({
        operationName,
        query,
        variables
    });

    const headers = {'x-ohana-version': OHANA_VERSION, 'Content-Type': 'application/json'};
    if (sessionId) {
        headers['Authorization'] = `Bearer ${sessionId}`;
    }

    //log(`Sending ${reqBody}`);
    const fetch = require('node-fetch');
    const response = await fetch(environment.serverEndpointUrl, {
        method: 'POST',
        body: reqBody,
        headers
    });

    //log(`${response.status} received.`);

    const body = await response.json();
    if (body.errors) {
        throw new Error(JSON.stringify(body.errors));
    }

    return body;
}

async function generateOAuthBearerToken(environment, browserOnly) {
    const {
        B2CLoginBaseUrl,
        hillromDigitalHealthBaseUrl,
        B2CClientId,
        oauthInstance,
        oauthPValue,
        localUrl,
        jwtMsUrl
    } = environment;
    const redirectUri = browserOnly ? jwtMsUrl : localUrl;
    const responseMode = browserOnly ? '' : '&response_mode=query';
    const B2C_URL = `https://${B2CLoginBaseUrl}/${hillromDigitalHealthBaseUrl}/oauth2/v2.0/authorize?p=${oauthPValue}&client_id=${B2CClientId}&nonce=defaultNonce&redirect_uri=${redirectUri}&scope=openid%20https%3A%2F%2F${hillromDigitalHealthBaseUrl}%2F${oauthInstance}%2Fuser_impersonation%20https%3A%2F%2F${hillromDigitalHealthBaseUrl}%2F${oauthInstance}%2Fread_write&response_type=id_token%20token&prompt=login${responseMode}`;

    log('Generating JWT bearer token ...');
    return await new Promise((resolve) => {
        log(`${B2C_URL} \n\nPlease click on the link above and authenticate.`);

        if (browserOnly) {
            resolve();
            return;
        }

        const app = require('express')();
        app.get('/login', async (req, res) => {
            resolve(req.query.access_token);

            res.send(`
            <h1>Authenticated</h1>
            <script type='application/javascript'>
                window.close();
            </script>
        `);

            res.status(200);
        });

        app.listen(4200, () => {
            log('Waiting for OAuth redirect ...');
        });
    });
}

async function generateSession(environment, caregiverOrAdmin, bearerToken, tenant) {
    const mutationName = caregiverOrAdmin ? 'caregiverCreateOrRefreshSession' : 'adminCreateOrRefreshSession';

    const device = {
        deviceId: 'none',
        osVersion: FIXTURE_DATA.DEVICES.OS_VERSION,
        deviceModel: FIXTURE_DATA.DEVICES.DEVICE_MODEL,
        appVersion: FIXTURE_DATA.DEVICES.APP_VERSION
    };

    const response = await gqlRequest(environment, 'createSession', `
        mutation createSession($bearer: String! $tenant: ID! ${caregiverOrAdmin ? '$device:DeviceInfoInput!' : ''}) { 
            ${mutationName}(bearerToken: $bearer, tenantId: $tenant ${caregiverOrAdmin ? ', device:$device' : ''}) { 
                id
            } 
        }`, {
        bearer: bearerToken,
        tenant,
        device: caregiverOrAdmin ? device : undefined
    });

    return response.data[mutationName].id;
}

async function generateFamilyLink(environment, sessionId, patientId) {
    const response = await gqlRequest(environment, 'createLink', `
        mutation createLink($patientId:ID!){ 
            generateFamilyInvitationUrlByPatient(patientId:$patientId) 
        }`, {
        patientId
    }, sessionId);

    return response.data.generateFamilyInvitationUrlByPatient;
}

async function generateFamilyMember(environment, familyMember, invitationToken, familyMemberAttributes = {}) {
    const {
        phoneNumber = FIXTURE_DATA.PHONES.DOMESTIC,
        preferredLocale = FIXTURE_DATA.LOCALES.EN_US,
        patientDateOfBirth = FIXTURE_DATA.DATES_OF_BIRTH.MILLENNIAL,
        patientRelationship = FIXTURE_DATA.RELATIONSHIPS.SIBLING,
        firstName = FIXTURE_DATA.NAMES.ALICE.firstName,
        lastName = FIXTURE_DATA.NAMES.ALICE.lastName
    } = familyMemberAttributes;

    await gqlRequest(environment, 'registrationChallenge',
        `query registrationChallenge {
                registrationChallenge(invitationToken: "${invitationToken.split('=')[1]}") { challengeString }
            }`
    );

    const publicKey = FIXTURE_DATA.FAMILY_MEMBER.PUBLIC_KEY.split('\n')[1] + FIXTURE_DATA.FAMILY_MEMBER.PUBLIC_KEY.split('\n')[2];

    const registrationResponse = (
        await gqlRequest(environment, 'registrationResponse',
            `mutation registrationResponse {
                registrationResponse(
                    invitationToken: "${invitationToken.split('=')[1]}"
                    challengeStringSigned: "${FIXTURE_DATA.FAMILY_MEMBER.SIGNED_CHALLENGE_STRING}"
                    publicKey: "${publicKey}"
                )
            }`
        )
    ).data.registrationResponse;

    await gqlRequest(environment, 'authenticationChallenge',
        `query authenticationChallenge {
                authenticationChallenge(userId: "${registrationResponse}")
            }`
    );

    const authenticationResponse = (
        await gqlRequest(environment, 'authenticationResponse',
            `mutation authenticationResponse {
                authenticationResponse(
                    challengeStringSigned: "${FIXTURE_DATA.FAMILY_MEMBER.SIGNED_CHALLENGE_STRING}"
                    userId: "${registrationResponse}"
                    device: {
                        deviceId: "${familyMember.id + '_Device'}"
                        deviceModel: "nodejs"
                        osVersion: "1.0",
                        appVersion: "1.0"
                    }
                ) { id }
            }`
        )
    ).data.authenticationResponse.id;

    const databaseId = (
        await gqlRequest(environment, 'finalizeFamilyMemberRegistration',
            `mutation finalizeFamilyMemberRegistration {
                finalizeFamilyMemberRegistration(
                    familyMember: {
                        phoneNumber: "${phoneNumber}"
                        preferredLocale: "${preferredLocale}"
                        patientDateOfBirth: "${patientDateOfBirth}"
                        patientRelationship: "${patientRelationship}"
                        firstName: "${firstName}"
                        lastName: "${lastName}"
                    }
                ) { id }
            }`, {}, authenticationResponse
        )
    ).data.finalizeFamilyMemberRegistration.id;

    await gqlRequest(environment, 'updatePushNotificationsConfig', `mutation updatePushNotificationsConfig {
          updatePushNotificationsConfig(
            config: {
              deviceId: "${familyMember.id + '_Device'}"
              deviceToken: "36dfbc31e9744c9da14a0358e1690171"
              partialKey: "${familyMember.id + '_PK'}"
              notificationPlatform: apns
            }
          ) {
            deviceId
          }
    }`, {}, authenticationResponse);

    return {authenticationResponse, databaseId};
}

/**
 * Deletes fixture data from the DB using data stored in files
 * @param {String} connectionString PSQL Connection string
 */
async function deleteFixtures(connectionString) {
    const {Client} = require('pg'), {promisify} = require('util');

    const client = new Client({connectionString});
    try {
        await client.connect();
    } catch (e) {
        console.log('A pgql error occured! ', e.message);
    }

    const queryAsync = promisify(client.query).bind(client);

    console.log('Cleaning all attachments');
    await queryAsync('DELETE FROM attachments;');
    console.log('Cleaning all audit_events')
    await queryAsync('DELETE FROM audit_events;');
    console.log('Cleaning all audit_events_reports')
    await queryAsync('DELETE FROM audit_events_reports;');
    console.log('Cleaning all device_info')
    await queryAsync('DELETE FROM device_info;');
    console.log('Cleaning all users_patients_mapping')
    await queryAsync('DELETE FROM users_patients_mapping;');
    console.log('Cleaning all family_identities')
    await queryAsync('DELETE FROM family_identities;');
    console.log('Cleaning all updates')
    await queryAsync('DELETE FROM updates;');
    console.log('Cleaning all encounters')
    await queryAsync('DELETE FROM encounters;');
    console.log('Cleaning all location_settings')
    await queryAsync('DELETE FROM location_settings;');
    console.log('Cleaning all patients')
    await queryAsync('DELETE FROM patients;');
    console.log('Cleaning all locations')
    await queryAsync('DELETE FROM locations;');
    console.log('Cleaning all tenant_settings')
    await queryAsync('DELETE FROM tenant_settings;');
    console.log('Cleaning all users')
    await queryAsync('DELETE FROM users;');
}

async function redisFlush(connectionString) {
    const redis = require('redis');

    const uri = new URL(connectionString);
    const options = {};
    if (uri.protocol === 'rediss:') {
        options.tls = {servername: uri.hostname};
    }

    const client = redis.createClient(connectionString, options);

    console.log('Flushing redis cache');
    await client.sendCommand('FLUSHALL');
}

function createADUserToken(fixture, role) {
    const payload = {
        sourceUser: fixture.id,
        given_name: FIXTURE_DATA.NAMES.JOHN.firstName,
        family_name: FIXTURE_DATA.NAMES.JOHN.lastName,
        hillrom: JSON.stringify({
            jobTitle: role === FIXTURE_DATA.ROLES.ADMIN ? FIXTURE_DATA.TITLES.ADMIN : FIXTURE_DATA.TITLES.NURSE,
            scopes: {
                roles: [role]
            }
        })
    };
    return jwt.sign(payload, JWT_SIGNING_SECRET);
}

module.exports = {
    gqlRequest,
    generateOAuthBearerToken,
    generateSession,
    generateFamilyLink,
    generateFamilyMember,
    deleteFixtures,
    createADUserToken,
    redisFlush
};
