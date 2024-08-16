const express = require('express'),
    bodyParser = require("body-parser"),
    {generateFamilyMembers} = require("./familyGenerator"),
    app = express();

app.use(bodyParser.json());
const port = 3000;

const validateFamilyMemberGenerator = (req, res, next) => {
    if(!req.body) {
        return res.status(500).send({
            error: 'No body params passed.'
        });
    }
    if(!req.body.patientId) {
        return res.status(500).send({
            error: 'patientId param was not passed.'
        });
    }
    if(!req.body.cgSessionId) {
        return res.status(500).send({
            error: 'cgSessionId param was not passed.'
        });
    }
    if(!req.body.patientDOB) {
        return res.status(500).send({
            error: 'patientDOB param was not passed.'
        });
    }
    if(!req.body.totalFM) {
        return res.status(500).send({
            error: 'totalFM param was not passed.'
        });
    }
    // validation passed
    next();
}

app.post('/familyMemberGenerator', validateFamilyMemberGenerator, (req, res) => {
    console.log('receiving data ...');
    console.log('body is ',req.body);

    generateFamilyMembers(
        req.body.environment,
        req.body.patientId,
        req.body.cgSessionId,
        req.body.patientDOB,
        req.body.totalFM,
        req.body.totalPFM,
        req.body.languageCodesPerPFM,
        req.body.languageCodesPerSFM
    )
        .then(() => {
            console.log("Success");
            return res.send(req.body);
        })
        .catch((err) => {
            console.log(`Failure ::: ${err}`);
            return res.status(500).send(err.message);
        });
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
