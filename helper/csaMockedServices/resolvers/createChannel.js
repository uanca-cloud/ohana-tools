const {uuidv4} = require("@graphql-tools/mock/utils");
const mockDate = new Date('05 October 2011 14:48 UTC');

function createChannelResolver (store) {
    return function createChannel (_, input ) {
        //TODO :: add logic to check if seed is unique in set store data
        const channelId = uuidv4();

        store.set('Mutation', channelId, 'createChannel', {
            channel: {
                id: channelId,
                seed: input.seed,
                createdAt: mockDate.toISOString(),
                lastActivityAt: mockDate.toISOString(),
                notificationLevel: 'loud'
            }
        });

        store.set('Query', channelId, 'channels', {
            edges: [{
                node: {
                    id: channelId,
                    seed: input.seed,
                    createdAt: mockDate.toISOString(),
                    lastActivityAt: mockDate.toISOString(),
                    notificationLevel: 'loud'
                }
            }]
        });

        return store.get('Mutation', channelId, 'createChannel');
    }
}

module.exports = { createChannelResolver };