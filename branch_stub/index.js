const PORT = process.env.PORT || 3000;

const express = require('express');

const app = express();

app.get('/branch_url', async (req, res) => {
    const fetch = require(`node-fetch`);
    const invitationUrl = req.query.invitationUrl;

    // add branch key here
    const branchKey = '';
    const branchIoResponse = await fetch(`https://api2.branch.io/v1/url?url=${invitationUrl}&branch_key=${branchKey}`, {
        method: 'GET'
    });

    const body = await branchIoResponse.json();
    if (body.errors) {
        throw new Error(JSON.stringify(body.errors));
    }

    res.send(body);
});

app.listen(PORT, () => {
    console.log(`Starting Branch Io Stub server on port ${PORT}`);
});