function registerTenantResolver (store) {
    return function registerTenant(_, { credentials }) {
        return true;
    }
}

module.exports = { registerTenantResolver };
