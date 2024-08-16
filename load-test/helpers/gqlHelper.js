const http = require('k6/http'),
    {buildErrorCounterMap, gqlErrorRate, gqlSuccessRate} = require('./metricHelper.js'),
    {debug = false} = __ENV,
    errorCounters = buildErrorCounterMap();

function generateSessionHeaders(sessionId) {
    return {
        'Authorization': `Bearer ${sessionId}`
    };
}

function processResponse(response) {
    const isOk = response.status === 200;

    if (debug) {
        console.log(`HTTP Status: ${response.status}`);
    }

    if (!isOk) {
        gqlErrorRate.add(true);
        gqlSuccessRate.add(false);

        let statusCounterName;

        if (response.status.toString() === '504') {
            statusCounterName = `HTTP ERROR -- ${response.status.toString().slice(0, 3)}`;
        } else {
            statusCounterName = `HTTP ERROR -- ${response.status.toString().slice(0, 1)}xx`;
        }

        const statusCounter = errorCounters.get(statusCounterName);

        if (statusCounter) {
            statusCounter.add(1);
        } else {
            console.log(`UNKNOWN ERROR: ${response.status.toString()}`);
        }

    } else {
        // record a failure if we get a 200 but with the error tag
        const body = response.json();

        if (!!body) {
            if (debug) {
                console.log(`HTTP Response Body: ${JSON.stringify(body)}`);
            }

            if (!!body.errors && !!body.errors.length) {
                gqlErrorRate.add(true);
                gqlSuccessRate.add(false);

                body.errors.forEach(error => {
                    const errorCode = error.extensions.code;
                    let gqlErrorCounterName = `GQL ERROR -- ${errorCode}`;

                    if (debug) {
                        console.log(`GQL Error Code: ${errorCode}`);
                    }

                    if (!errorCounters.has(gqlErrorCounterName)) {
                        gqlErrorCounterName = 'GQL ERROR -- UNKNOWN';
                    }

                    const gqlErrorCounter = errorCounters.get(gqlErrorCounterName);
                    gqlErrorCounter.add(1);
                });
            } else {
                gqlSuccessRate.add(true);
                gqlErrorRate.add(false);
            }
        } else {
            gqlErrorRate.add(true);
            gqlSuccessRate.add(false);
        }
    }
}

function gqlRequest(url, operationName = 'unknown', query = 'query unknown(){}', variables = {}, headers = {}, additionalTags = {}) {
    const body = JSON.stringify({
        operationName,
        query,
        variables
    }, null, null);

    const params = {
        headers,
        tags: Object.assign({}, {operationName}, additionalTags)
    };

    if (debug) {
        console.log(`HTTP Request Params: ${JSON.stringify(params)}`);
        console.log(`HTTP Request Body: ${body}`);
    }

    const response = http.post(url, body, params);
    processResponse(response);
    return response;
}

/**
 * @typedef GQLOptions
 * @type {Object}
 * @property {string} url
 * @property {string} operationName
 * @property {string} query
 * @property {object} [variables={}]
 * @property {object} [headers={}]
 * @property {object} [additionalTags={}]
 */

/**
 *
 * @param {GQLOptions[]} optionsList
 * @param {boolean} [recordMetrics=false]
 */
function gqlRequestBatch(optionsList, recordMetrics = false) {
    const requests = optionsList.map((options) => {
        const {url, operationName, query, variables = {}, headers = {}, additionalTags = {}} = options;
        const params = {
            method: 'POST',
            url,
            params: {
                headers,
                tags: Object.assign({}, { operationName }, additionalTags)
            },
            body: JSON.stringify({
                operationName,
                query,
                variables
            }, null, null)
        };

        if (debug) {
            console.log(`HTTP Request Params: ${JSON.stringify(params)}`)
            console.log(`HTTP Request Body: ${body}`);
        }
        return params;
    });
    const responses = http.batch(requests);
    if (recordMetrics) {
        responses.forEach(response => processResponse(response));
    }
    return responses;
}

module.exports = {
    generateSessionHeaders,
    processResponse,
    gqlRequest,
    gqlRequestBatch
};
