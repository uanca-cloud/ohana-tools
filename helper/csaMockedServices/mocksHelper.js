const
    { addMocksToSchema, relayStylePaginationMock } = require( '@graphql-tools/mock'),
    { registerTenantResolver } = require("./resolvers/registerTenant"),
    { createChannelResolver } = require("./resolvers/createChannel"),
    { sendChatResolver } = require("./resolvers/sendChat"),
    { channelsResolver } = require("./resolvers/channels");
const {uuidv4} = require("@graphql-tools/mock/utils");

const mockedCursor = `id:${uuidv4()}`,
    mockedDate = new Date();

const mockedDateString = mockedDate.toISOString();

function generateSchemaMocks() {
    const mocks = {
        SharedIdentity: () => "hrc:9.8.7.6:abc123",
        MetadataSchema: () => "{test: test}",
        Timestamp: () => mockedDateString,
        MediaType: () => "MediaTypeTest",
        //union mocked
        TextMessageElement: () => ({
            __typename: "ChatMessageTextElement",
            text: "test text for TextMessageElement",
        }),
        Channel: () => ({
            createdAt: mockedDateString,
            //initialChats: relayStylePaginationMock(store)
        }),
        PageInfo: () => ({
            startCursor: "null",
            endCursor: "null",
            totalCount: 2,
            offset: 1,
            continuationToken: "null"
        }),
        ChatMessageConnectionEdge: () => ({
            cursor: mockedCursor
        }),
        ChatMessageConnection: () => ({
            lastReadOrder: 2,
            lastUnreadOrder: 0,
            unreadCount: 0
        }),
        ChatMessage: () => ({
            channelSeed: "testMockChannelSeed123",
            order: 2,
            createdAt: mockedDateString,
        }),
        MemberConnectionEdge: () => ({
            cursor: mockedCursor
        })
    };
    return mocks;
}

function insertMocksToSchema(schema, mocks) {
    return addMocksToSchema({
        schema,
        mocks,
        resolvers: store => ({
            Query: {
                channels: channelsResolver(store)
            },
            Mutation: {
                registerTenant: registerTenantResolver(store),
                createChannel: createChannelResolver(store),
                sendChat: sendChatResolver(store)
            }
        })
    });
}

function resetMocks(store) {
    store.reset();
}

module.exports = { generateSchemaMocks, insertMocksToSchema };