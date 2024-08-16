module.exports.genPatient = (id) => ({
    name: [{
        given:['John'],
        family: 'Doe'
    }],
    birthDate: '2000-01-01',
    id: id.replace(/_[0-9]/g, '')
});