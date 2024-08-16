const jwt = require('jsonwebtoken');
const JWT_SIGNING_SECRET = 'secret';

class InMemoryCache {
    constructor() {
        this.clients = {
            '1234567890': {
                id: '1234567890',
                secret: JWT_SIGNING_SECRET,
                redirectUris: ['https://jwt.ms', 'https://aut-eus.vf.hrdev.io/x-callback-url/login', 'https://hfx-eus.vf.hrdev.io/x-callback-url/login'],
                grants: ['authorization_code', 'implicit'],
                accessTokenLifetime: 1800,
                refreshTokenLifetime: 3600
            }
        };

        this.users = {};
        this.codes = {};
        this.accessTokens = {};
        this.refreshTokens = {};
    }

    dump() {
        //TODO
    }

    getAccessToken(bearerToken) {
        const userId = this.accessTokens[bearerToken];
        const {token} = this.users[userId];
        return token || false;
    }

    getRefreshToken(bearerToken) {
        const userId = this.refreshTokens[bearerToken];
        const {token} = this.users[userId];
        return token || false;
    }

    getClient(clientId) {
        const client = this.clients[clientId];
        return client || false;
    }

    saveToken(token, client, user) {
        const userId = user.user_id;
        this.accessTokens[token.accessToken] = userId;
        this.refreshTokens[token.refreshToken] = userId;

        let storedUser = this.users[userId];
        if (!storedUser) {
            storedUser = {user, client};
            this.users[userId] = storedUser;
        }

        storedUser.token = token;

        console.log(`Saved token ${token.accessToken} and ${token.refreshToken} for ${user.user_id}`);

        //This wacky format is required because ... OSS
        return {...token, client: storedUser.client, user: storedUser.user};
    }

    getAuthorizationCode(code) {
        const userId = this.codes[code];
        const storedUser = this.users[userId];

        //This wacky format is required because ... OSS
        return {...storedUser.code, client: storedUser.client, user: storedUser.user};
    }

    revokeAuthorizationCode(code) {
        const userId = this.codes[code.authorizationCode];
        delete this.codes[code.authorizationCode];
        delete this.users[userId].code;

        console.log(`Revoked access for ${code.authorizationCode} on ${userId}`);

        return true;
    }

    generateAccessToken(client, user, scope) {
        const payload = {
            sourceUser: user.user_id,
            given_name: user.first_name,
            family_name: user.last_name,
            email: user.email,
            hillrom: JSON.stringify({
                jobTitle: user.title,
                scopes: {
                    roles: [user.role]
                }
            }
            )
        };

        const accessToken = jwt.sign(payload, JWT_SIGNING_SECRET);

        console.log(`Generated bearer token ${accessToken} for ${user.user_id}`);
        return accessToken;
    }

    saveAuthorizationCode(code, client, user) {
        this.codes[code.authorizationCode] = user.user_id;
        this.codes[code.expiresAt] = new Date();
        let storedUser = this.users[user.user_id];
        if (!storedUser) {
            storedUser = {user, client};
            this.users[user.user_id] = storedUser;
        }

        storedUser.code = code;

        console.log(`Saved code ${code.authorizationCode} for ${user.user_id}`);

        return code;
    }
}

module.exports = InMemoryCache;
