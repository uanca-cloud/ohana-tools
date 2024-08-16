const
    { ApolloServer } = require('@apollo/server'),
    { expressMiddleware } = require( '@apollo/server/express4'),
    { ApolloServerPluginDrainHttpServer } = require( '@apollo/server/plugin/drainHttpServer'),
    express = require( 'express'),
    http = require( 'http'),
    cors = require( 'cors'),
    bodyParser = require( 'body-parser'),
    { makeExecutableSchema } = require( '@graphql-tools/schema'),
    { generateSchemaMocks, insertMocksToSchema } = require('./mocksHelper');
    typeDefs = require("./schema");

const app = express();
const httpServer = http.createServer(app);

async function startServer() {
    const schema = makeExecutableSchema({typeDefs});
    const mocks = generateSchemaMocks();
    const mockedSchema = await insertMocksToSchema(schema, mocks);

    const server = new ApolloServer({
        schema: mockedSchema,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    });

    await server.start();

    app.use(
        '/',
        cors(),
        bodyParser.json(),
        // expressMiddleware accepts the same arguments:
        // an Apollo Server instance and optional configuration options
        expressMiddleware(server, {
            context: async ({ req }) => ({ token: req.headers.token }),
        }),
    );

    // Modified server startup
    await new Promise((resolve) => httpServer.listen({ port: 4002 }, resolve));
    app.use('/graphql',(req,res)=>{
        res.send("Hellow world");
    });

    console.log(`🚀 Server ready at http://localhost:4002/`);
}

startServer();