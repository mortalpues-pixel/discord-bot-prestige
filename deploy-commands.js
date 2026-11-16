require('dotenv').config();
const { loadCommands } = require('./utils/commandLoader');
const { registerCommands } = require('./utils/registerCommands');

// Registro manual (el bot ya lo hace solo al arrancar). Uso: node deploy-commands.js
(async () => {
    try {
        const { commands, skipped } = loadCommands();
        if (skipped.length) console.log(`Módulos desactivados: ${skipped.join(', ')}`);

        const names = await registerCommands({
            token: (process.env.DISCORD_TOKEN || '').trim(),
            clientId: process.env.CLIENT_ID,
            guildId: process.env.GUILD_ID,
            commands: [...commands.values()]
        });
        console.log(`Registrados ${names.length} comandos: ${names.join(', ')}`);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
})();
