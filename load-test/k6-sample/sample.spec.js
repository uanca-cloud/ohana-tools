import { check, group, sleep } from 'k6';

// Watch out for paths, they must end in the file extension for the K6 module loader
import { gqlRequest } from '../gqlHelper.js';
import { importJsonFile } from '../testHelper.js';

/*
VUs execute until completion and then start over until duration is complete
 */
// export const options = {
//     vus: 10,
//     duration: '10s',
// };

const jsonData = importJsonFile('./sample.json');

// runs once per test run
export function setup() {
    console.log(JSON.stringify(jsonData));
    console.log(jsonData[0].blah);

    return {
        blah: 'blah_value'
    };
}

export default function (dataForLifecycle) {
    console.log(dataForLifecycle.blah);
    const query = `
        query findLocales {
          locales {
            id
            country
            language
          }
        }
    `;

    group('group #1', () => {
        const response = gqlRequest('https://hfx-eus.vf.hrdev.io/graphql', 'findLocales', query, {}, { 'X-Ohana-Version': '1.1.0' });
        sleep(1);
        check(response, {
            'GQL-OK': (response) => !response.json().errors
        });
    });
}

// runs once per test run
export function teardown(dataForLifecycle) {
    console.log(dataForLifecycle.blah);
}
