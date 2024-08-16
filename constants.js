const
    ENVIRONMENTS = {
        LOCAL: {
            serverEndpointUrl: 'http://localhost:7071/graphql',
            redisConnectionString: 'redis://127.0.0.1:6379?password=redispass',
            attachMediaUrl: 'http://localhost:7071/attachMedia',
            clientLogsUrl: 'http://localhost:7072/clientLogs',
        },
        HOTFIX: {
            B2CClientId: '7f3412dc-5035-4e21-aa8a-2a19ee811642',
            B2CLoginBaseUrl: 'hillromdigitalhealth.b2clogin.com',
            hillromDigitalHealthBaseUrl: 'hillromdigitalhealth.onmicrosoft.com',
            oauthInstance: 'DhpHotfix',
            oauthPValue: 'B2C_1A_HotfixDhpSignin',
            serverEndpointUrl: `https://hfx-eus.vf.hrdev.io/graphql`,
            localUrl: 'http%3A%2F%2Flocalhost%3A4200%2Flogin',
            jwtMsUrl: 'https%3A%2F%2Fjwt.ms',
            redisConnectionString: '',
            attachMediaUrl: 'https://hfx-eus.vf.hrdev.io/attachMedia',
            clientLogsUrl: 'https://hfx-eus.vf.hrdev.io/clientLogs'
        },
        AUT: {
            B2CClientId: '1234567890',
            B2CLoginBaseUrl: 'hillromdigitalhealth.b2clogin.com',
            hillromDigitalHealthBaseUrl: 'hillromdigitalhealth.onmicrosoft.com',
            oauthInstance: 'dhpAUT',
            oauthPValue: 'B2C_1A_AUTDHPSIGNIN',
            serverEndpointUrl: `https://aut-eus.vf.hrdev.io/graphql`,
            localUrl: 'http%3A%2F%2Flocalhost%3A4200%2Flogin',
            jwtMsUrl: 'https%3A%2F%2Fjwt.ms',
            redisConnectionString: '',
            attachMediaUrl: 'https://aut-eus.vf.hrdev.io/attachMedia',
            clientLogsUrl: 'https://aut-eus.vf.hrdev.io/clientLogs'
        }
    },
    OHANA_VERSION = '1.9.0',
    FIXTURE_SETTINGS = {
        CAREGIVER_COUNT: 5 * 10, // LOCATION_COUNT * CAREGIVERS per location
        ADMIN_COUNT: 1,
        TENANT_COUNT: 100,
        LOCATION_COUNT: 5,
        PATIENT_COUNT: 5 * 6, // LOCATION_COUNT * PATIENTS per location
        FAMILY_MEMBER_COUNT: 5 * 6, // LOCATION_COUNT * FAMILY MEMBERS per location
        MAX_CAREGIVERS_PER_ENCOUNTER: 3,
        FAMILY_MEMBER_LIMIT_PER_TENANT: 10,
        UPDATE_ATTACH_MEDIA_WEIGHT: 0.4,
        UPDATE_QM_WEIGHT: 0.33,
        UPDATE_ATTACH_MULTIPLE_MEDIA_WEIGHT: 0.2,
        PATIENTS_IN_SHORT_TERM_LOCATIONS_WEIGHT: 0.3,
        UPDATE_COUNT_FOR_SHORT_TERM_LOCATIONS: 50,
        UPDATE_COUNT_FOR_LONG_TERM_LOCATIONS: 25,
        MULTIPLE_FMS_PER_ENCOUNTER_WEIGHT: 0.2,
        MULTIPLE_ATTACHMENTS_COUNT: 4,
        AUDIT_START_DATE: '2023-02-02',
        AUDIT_END_DATE: '2023-02-06',
        AUDIT_FILE_LOGS_WEIGHT: 0.2,
        AUDIT_MAX_TIMEOUT: 350000,
        AUDIT_POLLING_INTERVAL: 5000,
        MAX_ENCOUNTERS_PER_USER: 2
    },
    JWT_SIGNING_SECRET = 'secret',
    SECRET_PASSPHRASE = 'secret',
    FM_AUTH_CHALLENGE_STRING = 'b2hhbmE6b2hhbmE=',
    DEFAULT_LANGUAGE = 'en_US',
    FIXTURE_DATA = {
        ROLES: {
            CAREGIVER: 'Ohana Client',
            ADMIN: 'Ohana Administrator'
        },
        TITLES: {
            NURSE: 'Nurse',
            RT: 'Respiratory Therapist',
            ADMIN: 'IT Admin',
            TECHNICIAN: 'IT Technician'
        },
        NAMES: {
            DEBBIE: {
                firstName: 'Debbie',
                lastName: 'Rose'
            },
            BOB: {
                firstName: 'Bob',
                lastName: 'Dobbs',
                email: 'bob.dobbs@mailinator.com'
            },
            ALICE: {
                firstName: 'Alice',
                lastName: 'Johnson'
            },
            JOHN: {
                firstName: 'John',
                lastName: 'Doe'
            }
        },
        PHONES: {
            DOMESTIC: '555-555-5555',
            INTERNATIONAL: '122376498756478'
        },
        LOCALES: {
            EN_US: 'en_US',
            ES_MX: 'ex_MX',
            CR_HT: 'cr_HT'
        },
        DEVICES: {
            OS_VERSION: '1.0',
            DEVICE_MODEL: 'nodejs',
            APP_VERSION: '1.9'
        },
        LOCATIONS: {
            OR: 'OR',
            ICU: 'ICU',
            RECOVERY: 'Inpatient Recovery',
            ED: 'Emergency Department',
            NICU: 'NICU'
        },
        DATES_OF_BIRTH: {
            MILLENNIAL: '2000-01-01'
        },
        RELATIONSHIPS: {
            SIBLING: 'Sibling'
        },
        FAMILY_MEMBER: {
            PRIVATE_KEY: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIBvTBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQIw9eOKYTGOgUCAggA\nMAwGCCqGSIb3DQIJBQAwHQYJYIZIAWUDBAEqBBBcYDBTKcsb+3PCVFNi2jVHBIIB\nYDtLcE0HtrVN4MvsO1oS5RAp7S/Gluzh6vECLVn82S9ZuZnbqnBZQg8qmaIe7h3v\nnncmVbxVEEf8Z2/EaXXoqkOG+TPkSjZAEgwQwK7WRTqnrLHXY3+mkz3YdCtQuaIy\nx/bkMqmFhA0jmlkwlDrkn+/CXDz55tEAScjJou3lv4DDkCEeoD6Um1EJSmgeP+92\nvtyB/giVas7KAv6N53hac0kLJLW5bSPn+rkh89VES3ABCdOkNfWo2qoHcO8YppnZ\ng0xSWD4pF/FoD5QqdwF1PYqbeUsGNDBDCf+CP2DwFs4OVaTSnHW9opS1XPOvnNSu\n69ONfP7ki66OfendXNT1Hxs2uhzVmikx1RM74KFUn0mM+kDixaRawrfRDeIs+7nF\nR3ZhHsKb4KVFXdcFfL5pSpQhPWhRPwmigQ/r7XqSoaiRJYxouWC0BykJ8V2xXCTd\nM2Iv478/IKKkpE9f5MbBDfg=\n-----END ENCRYPTED PRIVATE KEY-----\n',
            PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALf05qSjhjMuBmD5OMsnZwbC8WI0zW/Q\nmwQftsrhaXeTFkNBaTjs5JsAA+t9QH5HMf6FvxBGEaUobTdjdBwq9zcCAwEAAQ==\n-----END PUBLIC KEY-----\n',
            SIGNED_CHALLENGE_STRING: 'YWoXrfvY+3jV0Dcz3TDYadDRm9ub6zCkQ0LosAjwNA1sgvEgYxXkZ61/bRB7QDKcocJ4R6BB1XimLfyyQIui3w=='
        }
    };

module.exports = {
    ENVIRONMENTS,
    OHANA_VERSION,
    FIXTURE_SETTINGS,
    FM_AUTH_CHALLENGE_STRING,
    JWT_SIGNING_SECRET,
    SECRET_PASSPHRASE,
    FIXTURE_DATA,
    DEFAULT_LANGUAGE
};
