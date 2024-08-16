const argv = require('yargs').argv,
    {deleteFixtures, redisFlush} = require('../helper.js'),
    {h: help, dir, c: connectionString, cr: redisConnectionString} = argv;

if (help) {
    console.log(`Usage:    
    node delete-fixtures-from-db --dir=<path_to_fixture_dir> -c=<postgres connection string> -cr=<redis connection string>
    `);
    process.exit(0);
}

if (!dir) throw new Error('"dir" required argument!');
if (!connectionString) throw new Error('"c" required argument!');
if (!redisConnectionString) throw new Error('"cr" required argument!');

Promise.all([
    deleteFixtures(connectionString),
    redisFlush(redisConnectionString)
]).then(() => console.log('Fixture deletion was successful!'))
    .catch((e) => console.log('Fixture deletion operation failed! ', e.message))
    .finally(() => process.exit(0));

module.exports = {deleteFixtures};
