const {
        generateLocationsGqlRequest,
        generatePatientsGqlRequest,
        generateCaregiverPatientMappingGqlRequest,
        updateTenantSettingsGqlRequest,
        findPatientInformationGqlRequest,
        addQMGqlRequest,
        getQMGqlRequest,
        getLocationsGqlRequest
    } = require('./generate-gql'),
    {ENVIRONMENTS, FIXTURE_SETTINGS, FIXTURE_DATA} = require('../constants.js'),
    {
        gqlRequest,
        generateSession,
        generateFamilyLink,
        generateFamilyMember,
        deleteFixtures
    } = require('../helper.js'),
    {getRandomInRange} = require('../load-test/helpers/plainHelper.js')
argv = require('yargs').argv,
    {resolve} = require('path'),
    {h: help, e: env, dir, debug, c: connectionString, vuCount} = argv;

if (help) {
    console.log(`Usage:    
    node add-fixtures-via-gql -e=<environment_name> --dir=<path_to_fixture_dir> --debug -c=<postgres connection string> -vuCount=<virtual users count>
    `);
    process.exit(0);
}

if (!dir) throw new Error('"dir" required argument!');
if (!connectionString) throw new Error('"c" required argument!');

const environment = ENVIRONMENTS[env ? env.toUpperCase() : 'HOTFIX'];

const dirPath = resolve(dir),
    filePath = `${dirPath}/tenants.json`;

(async _ => {
    console.time('Time elapsed: ');
    console.log('Inserting fixture data to DB...');
    const json = require(filePath);

    const tenants = json.tenants;
    const tenantChunkSize = Math.ceil(vuCount / FIXTURE_SETTINGS.TENANT_COUNT);
    const patientChunkSize = Math.ceil(vuCount / FIXTURE_SETTINGS.PATIENT_COUNT);
    const patientsPerTenant = Math.min(Math.ceil(vuCount / tenantChunkSize), FIXTURE_SETTINGS.PATIENT_COUNT);
    const encountersMap = new Map();

    try {
        for (let i = 0; i < tenantChunkSize; i++) {
            const tenant = tenants[i];
            const admin = tenant.admin;
            const shortId = tenant.shortId;
            const dbLocations = [];

            debug && console.log(`[${shortId}] - Authenticating admin user '${admin.id}'`);
            const adminSessionId = await generateSession(environment, false, admin.jwt, shortId);

            const [tenantSettingOperationName, tenantSettingQuery] = updateTenantSettingsGqlRequest();
            await gqlRequest(environment, tenantSettingOperationName, tenantSettingQuery, {}, adminSessionId);

            const [adminQMOperationName, adminQMQuery] = getQMGqlRequest();
            const qmResponse = await gqlRequest(environment, adminQMOperationName, adminQMQuery, {}, adminSessionId);

            if (!qmResponse || qmResponse?.data?.locationQuickMessages?.length === 0) {
                const [addQMOperationName, addQMQuery] = addQMGqlRequest();
                await gqlRequest(environment, addQMOperationName, addQMQuery, {}, adminSessionId);
            }

            const [locationsPerTenantOperationName, locationPerTenantQuery] = getLocationsGqlRequest();
            const locationsPerTenant = await gqlRequest(environment, locationsPerTenantOperationName, locationPerTenantQuery, {}, adminSessionId);

            if (!locationsPerTenant || locationsPerTenant.data.locations.length === 0) {
                const [locationsOperationName, locationsGql, locationVariables] = generateLocationsGqlRequest(json.locations);
                const locationsResponse = await gqlRequest(environment, locationsOperationName, locationsGql, locationVariables, adminSessionId);

                Object.values(locationsResponse.data).forEach((location) => {
                    dbLocations.push(location);
                });
            } else {
                dbLocations.push(...locationsPerTenant.data.locations);
            }

            for (let patientIndex = 0; patientIndex < patientsPerTenant; patientIndex++) {
                const cgId = patientIndex % FIXTURE_SETTINGS.CAREGIVER_COUNT;
                const assignedCaregivers = getRandomInRange(1, 3);
                const caregivers = tenant.caregivers.slice(cgId, cgId + assignedCaregivers);
                const patientChunkIndex = Math.floor(patientIndex / patientChunkSize);
                const patient = tenant.patients[patientChunkIndex];

                const randomSecondaryFMWeight = Math.random();
                const multipleFMsPerEncounter = randomSecondaryFMWeight <= FIXTURE_SETTINGS.MULTIPLE_FMS_PER_ENCOUNTER_WEIGHT;

                let secondaryFMCount = 0;
                if (multipleFMsPerEncounter) {
                    secondaryFMCount = getRandomInRange(1, FIXTURE_SETTINGS.FAMILY_MEMBER_LIMIT_PER_TENANT);
                }
                const randomShortTermWeight = Math.random();
                const isShortTermLocation = randomShortTermWeight <= FIXTURE_SETTINGS.PATIENTS_IN_SHORT_TERM_LOCATIONS_WEIGHT;

                let lastEncounterId, patientId, location;

                if (isShortTermLocation) {
                    location = dbLocations.find(location => location.label === FIXTURE_DATA.LOCATIONS.OR);
                } else {
                    location = dbLocations.find(location => location.label !== FIXTURE_DATA.LOCATIONS.OR);
                }

                const primaryCaregiver = caregivers[0];
                debug && console.log(`[${shortId}] - Authenticating caregiver user '${primaryCaregiver.id}'`);
                primaryCaregiver.sessionId = await generateSession(environment, true, primaryCaregiver.jwt, shortId);

                const randomEncountersNo = Math.floor(Math.random() * FIXTURE_SETTINGS.MAX_ENCOUNTERS_PER_USER) + 1;

                for (let j = 0; j < randomEncountersNo; j++) {
                    const patientExternalId = Date.now();
                    const [findPatientOperationName, findPatientQuery] = findPatientInformationGqlRequest(patientExternalId, shortId, primaryCaregiver.jwt);
                    await gqlRequest(environment, findPatientOperationName, findPatientQuery, {}, primaryCaregiver.sessionId);

                    const patientForEncounter = {
                        ...patient,
                        externalId: patientExternalId,
                        locationId: location.id
                    }
                    const [patientOperationName, patientGql, patientVariables] = generatePatientsGqlRequest([patientForEncounter]);
                    const patientResponse = await gqlRequest(environment, patientOperationName, patientGql, patientVariables, primaryCaregiver.sessionId);

                    if (!!patientResponse) {
                        lastEncounterId = patientResponse.data.patient0.lastEncounterId;
                        patientId = patientResponse.data.patient0.id;
                        encountersMap.set(patient.id, {patientId, lastEncounterId, primaryCaregiver});
                        debug && console.log(`[${shortId}] - Enrolled patient '${patientId}' on encounter '${lastEncounterId}' with primary caregiver '${primaryCaregiver.sessionId}'`);
                    }
                }

                if (encountersMap.has(patient.id)) {
                    const {patientId, lastEncounterId, primaryCaregiver} = encountersMap.get(patient.id);
                    const invitationToken = await generateFamilyLink(environment, primaryCaregiver.sessionId, patientId);

                    debug && console.log(`[${shortId}] - Generating primary family member`);

                    const {
                        authenticationResponse
                    } = await generateFamilyMember(environment, {}, invitationToken);

                    if (secondaryFMCount > 0) {
                        for (let fmIndex = 0; fmIndex < secondaryFMCount; fmIndex++) {
                            const invitationToken = await generateFamilyLink(environment, authenticationResponse, patientId);

                            debug && console.log(`[${shortId}] - Generating secondary family member`);

                            await generateFamilyMember(environment, {}, invitationToken);
                        }
                    }

                    for (let index = 1; index < caregivers.length; index++) {
                        const caregiver = caregivers[index];
                        debug && console.log(`[${shortId}] - Authenticating caregiver user '${caregiver.id}'`);
                        caregiver.sessionId = await generateSession(environment, true, caregiver.jwt, shortId);

                        const mapping = {encounterId: lastEncounterId, patientId};
                        const [mappingOperationName, mappingGql, mappingVariables] = generateCaregiverPatientMappingGqlRequest([mapping]);

                        debug && console.log(`[${shortId}] - Assigning caregiver '${caregiver.sessionId}' to patient '${mapping.patientId}' on encounter '${mapping.encounterId}'`);
                        await gqlRequest(environment, mappingOperationName, mappingGql, mappingVariables, caregiver.sessionId);
                    }
                }
            }
        }

        console.timeLog('Time elapsed: ');
    } catch
        (e) {
        console.timeEnd('Time elapsed: ');
        // Write data up until the point of failure (to include all existing dbIds)
        console.log(`An error appeared while inserting fixture data from ${filePath} ...`);

        console.log('Cleaning up fixture data...');
        await deleteFixtures(connectionString);

        throw new Error(e);
    }
    console.log('Succesfully inserted fixtures!');
    console.timeEnd('Time elapsed: ');
})
();
