const {uuidv4} = require("@graphql-tools/mock/utils");
const mockDate = new Date();

function sendChatResolver (store) {
    return function sendChat (_, input ) {
        //TODO :: add logic to check if seed is unique in set store data
        const chatId = uuidv4();
        store.set('Mutation', chatId, 'sendChat', {
            message: {
                id: chatId,
                channelSeed: input.seed,
                order: 1,
                sentBy: {
                    id: 'mock_user_id',
                    identity: 'hrc:9.8.7.6:abc123',
                    notificationLevel: 'loud'
                },
                createdAt: mockDate.toISOString(),
                priority: input.priority,
                status: 'created',
                text: input.text
            }
        });
        return store.get('Mutation', chatId, 'sendChat');
    }
}

module.exports = { sendChatResolver };