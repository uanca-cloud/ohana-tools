# Ohana Tools
Ohana tools is a repository containing K6 test scripts and other tools used to test the [ohana-server](https://github.com/Hillrom-Enterprise/ohana-server) project.

## Getting started
The testing environment has a few moving parts, mainly the latest [K6 binary](https://github.com/grafana/k6/releases) and [NodeJS](https://nodejs.org/en/).
You may install K6 as laid out in the [documentation](https://k6.io/docs/getting-started/installation/).
To run the tests locally, you can set up a local environment using the guidelines described in the [ohana-server](https://github.com/Hillrom-Enterprise/ohana-server) project.
A detailed guide for working with load tests and the vm can be found [here](https://hill-rom.atlassian.net/wiki/spaces/OHANA/pages/4021747882/Ohana+--+Load+testing+using+a+custom+action+runner+located+in+a+VM).

## Running load tests

### Prerequisites

#### Creating custom mock data
To create a set of files containing mock data with custom parameters, run `node create-multiple-fixtures` in the terminal. This will use the parameters defined in the `FIXTURE-SETTINGS` variable from `constants.js` to determine the quantity of mock data to be created for each tenant.

To create a single file with multiple tenants, run `node create-single-fixture` in the terminal. This will use the parameters defined in the `FIXTURE-SETTINGS` variable from `contants.js` to determine the quantity of mock data to be created for each tenant.

After the script has been completed, you will find the `.temp` directory at the project's root. A new folder will contain all the fixture json files (s). You must manually copy and paste these files to `./load-test/fixtures/`; remember to delete any previous files to avoid duplication.

#### Setting up the Ohana server
Locally:
* Start the mock server in a new terminal in the `ohana-tools/zenith_stub` dir using `node index.js`. This is needed for the cross encounter change, which mocks that service.
* In `ohana-server/fastify-api/.env` change:
  * `ZENITH_QUALIFIED_DOMAIN_NAME=http://host.docker.internal:3033`
  * `DISABLE_ZENITH_VERIFICATION=true`

Hotfix:
* detailed steps for changes can be found [here](https://hill-rom.atlassian.net/wiki/spaces/OHANA/pages/4021747882/Ohana+--+Load+testing+using+a+custom+action+runner+located+in+a+VM#Hotfix-setup).

#### Adding mock data to the server's database
A `fixtures` folder exists under the `load-test` directory, which should contain mock JSON data generated automatically by a script (see Creating custom mock data section). To upload the mocked fixture data to the server's database, we must run `node fixture-generator/add-fixtures-via-gql -e=<enviroment load test should target> --dir=./load-test/fixtures --debug -c=<psql_connection_string>` in the terminal.

This will start the `add-fixtures-via-gql` script that will upload all the data from `./load-test/fixtures` into the **hotfix** environment (by default) of the ohana-server project. If you want to specify a different environment to upload the fixture data, use the `-e env=<environment>` flag. Available environments can be found in the `./constants` file.

While uploading the mock fixture data, the script will write the database's ID for each of the entries introduced inside the corresponding JSON file, as well as the session ID of each caregiver.

### Starting load test scripts
To test scripts, run `k6 run <file_name> -e <environment_var=value>`.
#### Available load tests
All tests can be found in the `./load-test/` directory.
* simple_start.spec.js
  * Tests caregiver session creation and termination. This caregiver will contain a list of patients.
  * [Simple start](https://hill-rom.atlassian.net/wiki/spaces/OHANA/pages/3069739081/Simple+Session) test details and historical documentation.
* shift_change.spec.js
  * Tests a practical scenario of caregiver users logging out and simulating a (healthcare professional's) shift change with an exponential increase of requests. Each patient will have one family member associated with them assigned to the caregiver user.
  * [Shift change](https://hill-rom.atlassian.net/wiki/spaces/OHANA/pages/3335225479/Shift+Change) test details and historical documentation.
* media_update.spec.js
  * Tests media update creation and upload.
  * [Media update](https://hill-rom.atlassian.net/wiki/spaces/OHANA/pages/3825401975/Media+Updates) test details and historical documentation.
* constant_iterations.spec.js
  * Tests caregiver and family member session creation and termination. Caregivers will generate updates, and family members will mark the updates as read. Family members will be then removed from that patient while new family members wil be added and mark the update as read.
  * [Constant iteration](https://hill-rom.atlassian.net/wiki/spaces/OHANA/pages/4244701221/OHS-618+--+Constant+Iterations) test details and historical documentation.
* steady_state.spec.js
  * Tests caregiver and family member session creation and termination. Caregivers will generate updates (based on the configuration definition), and the family member marks the updates as read.
  * [Steady state](https://hill-rom.atlassian.net/wiki/spaces/OHANA/pages/3335782485/Steady+State) test details and historical documentation.

### Load Test results
To understand and be able to evaluate all of the metrics that **K6** offers us, I recommend reading the [k6 documentation](https://k6.io/docs/using-k6/metrics/) regarding all of its metrics.

Inside the `helpers` folder, a variety of custom _trends_ and _checks_ are defined, which give us more insight into the results of the tests.

### Load Test Tools
The ohana-tools repository contains a series of tools to generate or upload data.
- `populateRedisScript.js` - Traverses mock data JSONs and inserts a family invitation token into Redis for each family member.

- `create-audit-fixtures.js` - Inserts mock audit data and media files into the database and Azure blob storage.

- `generate-gql.js` - Generates graphQL queries used when querying multiple inputs at once.

- `delete-fixtures-from-db.js` - Deletes fixture data stored inside the target DB.

- `branch_stub` - Starts up an endpoint to create invitation tokens, generally used in automation.

- `helper.js` - Contains miscellaneous scripts used when uploading data or running tests.

- `./helper/app.js` -  This file generates specific data sets for the ohana-server project through express request. Run `node helper/app.js` in the terminal.

### Load test troubleshooting
Too many open files
* This error appears when a large number of files is opened, but in practice, this occurs when sending a large number of requests to the server during a test run.
* **Fix**: set the file limit to a large number `ulimit -n 250000`

Dial i/o timeouts
* This error appears when a large number of concurrent requests is sent.
* **Fix**: add a small enough sleep timer between requests so that they largely disappear (if the test methodology allows it).

## Other Available Tools

### Family Member Generator (local env only)
Creates multiple primary and secondary family members with specified languages with the option to set the first primary family member as a patient.
- Setup Actions:
  - Have the OHS project running locally, and the .env file is set up correctly (for Local env).
  - Create a Caregiver session and copy the sessionId.
  - Enroll the Patient with the Caregiver. Copy the new patient ID and the patient's DOB.

- Getting started
  - `./helper/index.js` -  This directory and index file is used to generate specific data sets for the ohana-server project through the CLI. For this project, we use the npm library [yargs](https://www.npmjs.com/package/yargs) to outline specific commands to create desired mock data sets. Details on each argument can be found with this command `node helper/index generateFamilyMembers --help`
  - To get started, review the helper services in the ./helper directory. Confirm yargs is installed, and any prerequisite setup actions are taken (such as creating a caregiver session to pass that ID as an argument in the CLI).
- Examples:
  1. Example for 1 PFM and 2 SFM: `node helper/index generateFamilyMembers --cgSessionId="123-abc" --patientId="1" --patientDOB="1995-07-05" --totalFM=3 --totalPFM=1 --languageCodesPerPFM.zh_TW=1  --languageCodesPerSFM.de_DE=1 --languageCodesPerSFM.fr_FR=1`
  2. Example for 2 PFM and 0 SFM: `node helper/index generateFamilyMembers --cgSessionId="123-abc" --patientId="1" --patientDOB="1995-07-05" --totalFM=2 --languageCodesPerPFM.es_ES=2`
  3. Example for 1 PFM and 1 SFM with default language code: `node helper/index generateFamilyMembers --cgSessionId="123-abc" --patientId="1" --patientDOB="1995-07-05" --totalFM=2 --totalPFM=1`
  4. Example for 2 PFM and 1 SFM with default language code and the first PFM being set as patient: `node helper/index generateFamilyMembers --cgSessionId="85802139-bdee-4f02-a961-824b56c511ff" --patientId="12" --patientDOB="1995-07-05" --totalFM=3 --totalPFM=2 --asPatient=true`

### CSA Mocked Schema (local env only)
This feature tool allows the Ohana team to expose mocked data for the CSA GraphQL schema locally. The mocked CSA data uses [Graphql Tools Mocking library](https://the-guild.dev/graphql/tools/docs/mocking). The need for the CSA mocked schema is to allow Ohana devs to continue with app development and implementation even if CSA is unavailable.
- Getting Started: run `node helper/csaMockedServices/server.js`
