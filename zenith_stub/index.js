const PORT = process.env.PORT || 3033;

const {readFileSync} = require('fs'),
    bodyParser = require('body-parser'),
    express = require('express'),
    OAuthServer = require('./vendor/express-oauth-server-2.0.0'),
    InMemoryModel = require('./InMemoryModel'),
    {genPatient} = require("./helpers"),
    cors = require('cors');

const app = express();

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.oauth = new OAuthServer({model: new InMemoryModel(),
    accessTokenLifetime: 3600
});

app.use(express.static(`${__dirname}/`));
app.get('/oauth2', (request, response) => {
    const fileContents = readFileSync(`${__dirname}/index.html`);

    response.contentType('text/html');
    response.status(200);
    response.send(fileContents.toString());
});

const authorizeRouter = express.Router();
authorizeRouter.use(app.oauth.authorize({
    allowEmptyState: true,
    authenticateHandler: {
        handle: (req) => {
            return req.query;
        }
    }
}));
app.use('/oauth2/authorize', authorizeRouter);

const tokenRouter = express.Router();
tokenRouter.use(app.oauth.token());
app.use('/oauth2/token', tokenRouter);

app.get('/Catalog/CatalogService/api/v1.0/Catalog/Entity/:tenantId', async (request, response) => {
    response.status(200);
    response.send({
        name: 'Test Tenant from Zenith Stub'
    });
});

app.get('/Patient/PatientService/api/v1.0/:tenantId/:id', async (req, res) => {
    res.status(200);
    res.send(genPatient(req.params.id));
});

app.get('/Encounter/EncounterService/api/v1.0/:tenantId/Encounter', async (req, res) => {
    res.status(200);
    res.send({
        entry: [{
            resource: {
                subject: {
                    reference: req.query.identifier
                }
            }
        }]
    });
});

app.listen(PORT,() => {
    console.log(`Starting OAuth2 server on port ${PORT}`);
});

/*
1. GET http://localhost:3033/oauth2
2. POST http://localhost:3033/oauth2/authorize?client_id=1234567890&grant_type=authorization_code&response_type=code&redirect_url=https%3A%2F%2Fjwt.ms - user details in body
3. POST http://localhost:3033/oauth2/token?client_id=1234567890&grant_type=authorization_code - code in body
 */
