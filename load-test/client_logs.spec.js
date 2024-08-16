const {binArrayToStr, importJsonFile} = require('./helpers/testHelper.js'),
    {getRandomInRange} = require('./helpers/plainHelper.js'),
    {setupFixtures} = require('./helpers/operationsHelper.js'),
    {
        auditReportJobs,
        clientLogs,
        createAdminSession,
        createAuditReport,
        createCaregiverSession
    } = require('./operations.js'),
    {ENVIRONMENTS, FIXTURE_SETTINGS} = require('../constants.js'),
    {assert, createTrend} = require('./helpers/metricHelper.js'),
    {group, sleep} = require('k6'),
    {Counter, Rate} = require('k6/metrics'),
    {setInterval, clearInterval} = require('k6/experimental/timers'),
    sql = require('k6/x/sql'),
    redis = require('k6/experimental/redis');

const environment = ENVIRONMENTS[__ENV.env ? __ENV.env.toUpperCase() : 'HOTFIX'];

// ./binaries/osx/k6 run -e vuCount=1 -e env=LOCAL -e db="postgres://ohana_user:ohana@localhost:5432/ohana?sslmode=disable" -e redisHost="localhost:6379" -e redisPassword=redispass load-test/client_logs.spec.js
const pgConnectionString = __ENV.db;
if (!pgConnectionString) {
    throw new Error('Database connection string is missing!')
}
const redisHost = __ENV.redisHost;
if (!redisHost) {
    throw new Error('Redis host string is missing!')
}
const redisPassword = __ENV.redisPassword;
if (!redisPassword) {
    throw new Error('Redis password is missing!')
}

const CREATE_AUDIT = 'Create Audit Report',
    UPLOAD_LOGS = 'Upload Client Logs',
    CREATED_AUDITS = 'Created audit reports',
    GENERATED_AUDITS = 'Generated audit reports',
    GET_AUDITS = 'Get audit reports',
    SENT_LOGS = 'Sent logs',
    GZIP_LOGS = 'Rate of gzip logs';

const createAuditTrend = createTrend(CREATE_AUDIT),
    clientLogsTrend = createTrend(UPLOAD_LOGS),
    getAuditsTrend = createTrend(GET_AUDITS),
    generateAuditsTrend = createTrend(GENERATED_AUDITS),
    gzipLogRate = new Rate(GZIP_LOGS);

const createdAuditsCounter = new Counter(CREATED_AUDITS),
    sentLogsCounter = new Counter(SENT_LOGS);

const json = importJsonFile(`./fixtures/tenants.json`);
const tenants = json.tenants;
const vuCount = __ENV.vuCount;

const db = sql.open("postgres", pgConnectionString);
const redisClient = new redis.Client({
    addrs: [redisHost], // in the form of 'host:port', separated by commas
    password: redisPassword,
    readTimeout: 60
});

const logsFileBytes = [31, 139, 8, 0, 0, 0, 0, 0, 0, 3, 205, 143, 65, 139, 194, 48, 20, 132, 255, 74, 120, 87, 125, 146, 100, 211, 36, 245, 42, 44, 120, 89, 15, 30, 101, 15, 105, 50, 46, 5, 219, 149, 166, 43, 130, 248, 223, 109, 86, 17, 252, 7, 30, 223, 12, 51, 111, 62, 230, 217, 108, 119, 161, 177, 237, 144, 199, 208, 29, 105, 169, 172, 81, 86, 121, 227, 204, 92, 208, 1, 39, 28, 104, 41, 104, 253, 245, 185, 161, 73, 232, 67, 135, 114, 111, 145, 115, 251, 219, 111, 49, 156, 218, 136, 226, 228, 187, 178, 78, 197, 174, 93, 210, 90, 215, 123, 150, 214, 130, 13, 188, 227, 96, 162, 100, 133, 166, 137, 85, 181, 71, 108, 84, 9, 253, 101, 12, 247, 68, 240, 74, 67, 5, 199, 242, 67, 106, 54, 17, 142, 107, 239, 19, 107, 111, 229, 212, 100, 85, 52, 161, 36, 166, 157, 57, 252, 252, 111, 88, 13, 8, 35, 146, 120, 124, 94, 208, 117, 46, 94, 80, 232, 201, 82, 209, 187, 195, 60, 54, 136, 182, 79, 56, 35, 77, 48, 223, 55, 37, 70, 213, 17, 156, 1, 0, 0];
const logsFileArr = new Uint8Array(logsFileBytes);

const logsText = '--++[{"timestamp":1641618474, "level": "INFO", "name": "SessionService", "sessionId": "97d2229f-066e-4e87-a4c0-1ebbc55fecb1", "userId": "a812e1a7-0302-4ce7-988d-286022961c4a", "message": "Created session."}, {"timestamp":"1641618475", "level": "INFO", "name": "SessionService", "sessionId": "97d2229f-066e-4e87-a4c0-1ebbc55fecb1", "userId": "a812e1a7-0302-4ce7-988d-286022961c4a", "message": "Session indexed."}]';

module.exports.options = {
    scenarios: {
        default: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                {duration: `30s`, target: vuCount},
                {duration: '5m', target: vuCount},
                {duration: `30s`, target: 0}
            ],
            gracefulRampDown: '30s',
            gracefulStop: '30s'
        }
    },
    thresholds: {
        'iteration_duration{scenario:default}': [`max>=0`],
        'iteration_duration{scenario:::setup}': [`max>=0`],
        'http_req_duration{scenario:default}': [`max>=0`],
        'http_req_duration{scenario:setup}': [`max>=0`]
    },
    setupTimeout: '30m',
    teardownTimeout: '30m'
};

module.exports.setup = function () {
    setupFixtures(environment, tenants);
}

module.exports.default = function () {
    const clientRequestsNo = getRandomInRange(1, 30);
    const tenant = tenants[0];
    const caregiver = tenant.caregivers[0];
    const auditReportIds = [];

    const adminSessionId = createAdminSession(environment, tenant.admin.jwt, tenant.shortId);
    const cgSessionId = createCaregiverSession(environment, null, tenant.shortId, caregiver);

    group('upload client logs', () => {
        for (let j = 0; j < clientRequestsNo; j++) {
            const randomFileLogChance = Math.random();
            let logContent = logsText;
            let logType = 'json';
            if (randomFileLogChance <= FIXTURE_SETTINGS.AUDIT_FILE_LOGS_WEIGHT) {
                logContent = binArrayToStr(logsFileArr);
                logType = 'gzip';
                gzipLogRate.add(1);
            } else {
                gzipLogRate.add(0);
            }
            const logsResponse = clientLogs(environment, clientLogsTrend, cgSessionId, logType, logContent);
            assert(UPLOAD_LOGS, logsResponse.status === 200);
            sentLogsCounter.add(1);
        }
    });

    group('generate audit reports', () => {
        if (!!adminSessionId) {
            const endDate = new Date();
            const endDateStr = `${endDate.getFullYear()}-${('0' + (endDate.getMonth() + 1)).slice(-2)}-${('0' + endDate.getDate()).slice(-2)}`;
            const startDate = new Date(new Date().setMonth(endDate.getMonth() - 1));
            const startDateStr = `${startDate.getFullYear()}-${('0' + (startDate.getMonth() + 1)).slice(-2)}-${('0' + startDate.getDate()).slice(-2)}`;
            const auditResponse = createAuditReport(environment, createAuditTrend, adminSessionId, startDateStr, endDateStr);
            if (auditResponse) {
                auditReportIds.push({id: auditResponse.id, time: Date.now()});
            }
            assert(CREATE_AUDIT, !!auditResponse);
            createdAuditsCounter.add(1);
        }
    });

    sleep(1);
    group('check audit reports status', () => {
        const statusCheckStartDate = Date.now();
        const reportStatusChangeInterval = setInterval(() => {
            try {
                const auditReports = auditReportJobs(environment, getAuditsTrend, adminSessionId);
                assert(GET_AUDITS, !!auditReports);
                if (!!auditReports) {
                    const iterationReports = auditReports.filter(report => !!auditReportIds.find(auditReport => auditReport.id === report.id));
                    iterationReports.forEach(report => {
                        if (report.status !== 'pending') {
                            const reportTimeData = auditReportIds.find(auditReport => auditReport.id === report.id);
                            if (!!reportTimeData) {
                                const elapsedTime = Date.now() - reportTimeData.time;
                                generateAuditsTrend.add(elapsedTime);
                            }
                        }
                    });
                }
                const pendingAudits = auditReports.filter(auditReport => auditReport.status === 'pending');
                if (pendingAudits.length === 0) {
                    clearInterval(reportStatusChangeInterval);
                }
            } catch (e) {
                console.error(e);
                clearInterval(reportStatusChangeInterval);
            }
            if (Date.now() - statusCheckStartDate > FIXTURE_SETTINGS.AUDIT_MAX_TIMEOUT) {
                clearInterval(reportStatusChangeInterval);
            }
        }, FIXTURE_SETTINGS.AUDIT_POLLING_INTERVAL);
    });
};

module.exports.teardown = function () {
    db.exec(`DELETE FROM attachments;
            DELETE FROM audit_events;
            DELETE FROM audit_events_reports;
            DELETE FROM device_info;
            DELETE FROM users_patients_mapping;
            DELETE FROM family_identities;
            DELETE FROM updates;
            DELETE FROM encounters;
            DELETE FROM location_settings;
            DELETE FROM patients;
            DELETE FROM locations;
            DELETE FROM tenant_settings;
            DELETE FROM users;`);
    db.close();
    try {
        redisClient.sendCommand('FLUSHALL')
            .then(() => console.log('Redis cache flushed'))
            .catch(() => console.error('Redis flush failed'));
    } catch (error) {
        console.error(error);
    }
}