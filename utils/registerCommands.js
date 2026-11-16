const { REST, Routes } = require('discord.js');

/**
 * Sobrescribe los slash commands del servidor (o globales si no hay GUILD_ID).
 * Idempotente: si los comandos no cambian, Discord no cuenta creaciones nuevas.
 */
async function registerCommands({ token, clientId, guildId, commands }) {
    const rest = new REST().setToken(token);
    const body = commands.map(c => c.data.toJSON());
    const route = guildId
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId);

    await rest.put(route, { body });
    return body.map(c => c.name);
}

module.exports = { registerCommands };
