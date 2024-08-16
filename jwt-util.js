const argv = require('yargs').argv;
const {ENVIRONMENTS} = require('./constants.js');
const {generateOAuthBearerToken, generateSession, generateFamilyLink} = require('./helper.js');

function log(message) {
    console.log(message);   // eslint-disable-line
}

async function run() {
    const {h, session, tenant, caregiver, admin, patient, familyLink, browser, dev, stage} = argv;

    if (h) {
        log(`
        Usage: node --max-http-header-size 65535 jwt-util.js [action] [options]
        
        Actions:
            nothing, signifies to only generate a JWT
            --session, signifies to generate a value session ID for a caregiver or admin
            --familyLink, signifies to generate a family link for an patient 
        
        Options:
            --dev, To use the Ohana development environment as a source
            --test, To use the Ohana test environment as a source (default)
            --stage, To use the Ohana stage environment as a source
            --browser, To use https://jwt.ms as the redirect URI for the JWT token
            --tenant=value, Site code for caregivers, UUID for admins
            --caregiver, Flag to signify a caregiver session
            --admin, Flag to signify a admin session
            --patient=value, Patient ID to for which to generate the family link
        
        Examples:
            Generate JWT:
                node --max-http-header-size 65535 jwt-util.js
            Generate caregiver session:
                node --max-http-header-size 65535 jwt-util.js --session --caregiver --tenant=0UK9
            Generate admin session:
                node --max-http-header-size 65535 jwt-util.js --session --admin --tenant=9f3ba8b6-69a4-eb11-85aa-2818783a9d2b
            Generate family link:
                node --max-http-header-size 65535 jwt-util.js --familyLink --tenant=0UK9 --patient=20
        `);

        process.exit(0);
    }

    if (session && !((caregiver || admin) && tenant)) {
        log('Must provide caregiver and admin and tenant arguments to generate a session!');
        process.exit(1);
    }

    if (familyLink && !([patient] && tenant)) {
        log('Must provide patient and tenant arguments for family link!');
        process.exit(1);
    }

    let environment = ENVIRONMENTS.HOTFIX;
    if (dev) {
        environment = ENVIRONMENTS.DEV;
    } else if (stage) {
        environment = ENVIRONMENTS.STAGE;
    }

    const bearerToken = await generateOAuthBearerToken(environment, browser);

    if (!session && !familyLink && !browser) {
        log(`\nJWT Bearer Token:\n\n${bearerToken}\n`);
    } else if (session) {
        const caregiverOrAdmin = !!caregiver && !admin;
        const sessionId = await generateSession(environment, caregiverOrAdmin, bearerToken, tenant);
        log(`Session ID:\n\n${sessionId}\n`);
    } else if (familyLink) {
        const sessionId = await generateSession(environment, true, bearerToken, tenant);
        const url = await generateFamilyLink(environment, sessionId, patient);
        log(`Family Member URL:\n\n${url}\n`);
    }

    process.exit(0);
}

run();
