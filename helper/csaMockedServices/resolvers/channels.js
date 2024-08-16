const {uuidv4} = require("@graphql-tools/mock/utils");
const mockedDate = new Date();

function channelsResolver (store) {
    return function channels (_, offset, limit ) {
        const mockedChannelConnection = {
            edges: [{
                node: {
                    id: uuidv4(),
                    seed: 'mockSeed123',
                    createdAt: mockedDate.toISOString(),
                    lastActivityAt: mockedDate.toISOString(),
                    notificationLevel: "loud",
                    members: {},
                    metadata: null
                },
                cursor: "id:f7ff41de-524a-4aae-97ff-2de1761f0d88"
            }],
            pageInfo: {
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: null,
                endCursor: null,
                totalCount: 1,
                offset: 0,
                continuationToken: null
            }
        }
        return mockedChannelConnection
    }
}

module.exports = { channelsResolver };