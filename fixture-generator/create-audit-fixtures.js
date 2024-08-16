const {readFileSync} = require('fs');
const argv = require('yargs').argv;
const {BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential} = require('@azure/storage-blob');
const {promisify} = require('util');
const {generateAuditData, randomDate} = require('./fixtures');
const {v4: uuid}= require('uuid');
const { Client } = require('pg');
const AZURE_MEDIA_CONTAINER_NAME = "media";
const PHOTO = 'photo';
//set Timezone to UTC before script start
process.env.TZ = 'UTC';

const {h: help, t: tenantId, u: userId, s: startDate, e: endDate, c:connectionString, x: azureStorageAccountConnectionString, n:auditEventsNumber} = argv;
if (help) {
    console.log(`Usage:    
    node create-audit-fixtures -t=<tenant_id> -u=<user_id> -s=<start_date 2022-02-07> -e=<end_date 2022-02-08> -c=<connection_string> -x=<azure_storage_account_connection_string> -n=<audit_events_number>
    `);
    process.exit(0);
}

async function createDbConnection(connectionString) {

    const client = new Client({connectionString});
    client.on('error', (error) => {
        console.log(`Unexpected DB connection error! ${error.message}`);
    });
    try{
        await client.connect();
    } catch (e) {
        console.log(e.message);
    }
    return client;
}

function bootstrapStorageAccount(azureStorageAccountConnectionString,containerName) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageAccountConnectionString);

    return blobServiceClient.getContainerClient(containerName);
}

async function insertTestAuditData(){
    const auditData = generateAuditData(tenantId, userId, 'update_sent', startDate, endDate);
    const testDataClient = await createDbConnection(connectionString);
    const containerClient = bootstrapStorageAccount(azureStorageAccountConnectionString, AZURE_MEDIA_CONTAINER_NAME);

    try{
        const tenantId = auditData.tenantId;
        const queryAsync = promisify(testDataClient.query).bind(testDataClient);
        //INSERT LOCATION
        const locationName = uuid();
        const result = await queryAsync(`INSERT INTO locations (label, tenant_id) VALUES ($1, $2) RETURNING id`, [locationName,tenantId])
        //INSERT PATIENT
        const {externalId, externalIdType, firstName, lastName, dateOfBirth} = auditData.patient;
        const locationId = result.rows[0].id;
        const patientResult = await queryAsync(`INSERT INTO public.patients(
        external_id, external_id_type, tenant_id, first_name, last_name, date_of_birth, location_id, allow_secondary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,[externalId,externalIdType, tenantId, firstName, lastName,dateOfBirth,locationId, false]);
        //INSERT CAREGIVER
        const {id: userId,roles:assignedRole,firstName: caregiverFirstName,lastName: caregiverLastName,title,email} = auditData.user;
        await queryAsync(`INSERT INTO public.users(
            user_id, tenant_id, assigned_roles, first_name, last_name, title, email)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,[userId,tenantId,[assignedRole],caregiverFirstName,caregiverLastName,title,email]);
        //INSERT ENCOUNTER
        const patientId = patientResult.rows[0].id
        const encounterResult = await queryAsync(`INSERT INTO encounters (
                patient_id,
                tenant_id,
                created_at,
                updated_at,
                external_id
            ) VALUES($1,$2,$3,$4, $5) returning id`,[patientId,tenantId, new Date(), new Date(), externalId]);
        const encounterId = encounterResult.rows[0].id;
        for(let i=0;i<auditEventsNumber;i++){
            const updateId = uuid();
            //INSERT AUDIT EVENTS
            const {eventId, device: {deviceId,deviceModel,osVersion,appVersion},
                scanStatus, invitationType,familyDisplayName,
                familyRelation,familyLanguage,familyContactNumber, user
            : {title}} = auditData;
            await queryAsync(`INSERT INTO audit_events(
                tenant_id,
                event_id,
                created_at,
                patient_id,
                performing_user_id,
                performing_user_type,
                performing_user_display_name,
                device_id,
                device_model,
                os_version,
                app_version,
                scan_status,
                update_content,
                update_id,
                invitation_type,
                family_display_name,
                family_relation,
                family_language,
                family_contact_number,
                location_id,
                performing_user_title)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,$20,$21)`,
                [tenantId, eventId, randomDate(startDate, endDate), patientId, userId, assignedRole,`${caregiverFirstName}_${caregiverLastName},`,
                deviceId, deviceModel, osVersion, appVersion, scanStatus, null, updateId, invitationType, familyDisplayName,
                familyRelation, familyLanguage, familyContactNumber, locationId, title]);

                //INSERT ATTACHMENTS
                const fileBuffer = readFileSync('./fixture-generator/red_panda.jpeg');
                await containerClient.uploadBlockBlob(`${encounterId}/${updateId}/red_panda`, fileBuffer, Buffer.byteLength(fileBuffer), {
                    blobHTTPHeaders: { blobContentType: 'jpeg' }
                });
                const id = uuid();
                const metadata = {
                        originalUrl: `${containerClient.url}/${encounterId}/${updateId}/red_panda`,
                        filename: 'red_panda'
                    };

                await queryAsync(`INSERT INTO attachments (
                id, update_id, patient_id, metadata, type, encounter_id
                ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,[id,updateId,patientId,metadata,PHOTO, encounterId])

                await queryAsync(`INSERT INTO updates (
                id, user_id, patient_id, message, created_at, encounter_id
                ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,[updateId, userId, patientId, '', new Date(), encounterId])
            }
    } catch (e){
        console.log(e.message);
    }
    await testDataClient.end();
}

insertTestAuditData().then(()=>console.log('Insert was successful')
).catch(()=>
    console.log('Insert operation failed')
).finally(()=>
    process.exit(0)
);
