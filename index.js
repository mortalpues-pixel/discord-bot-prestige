require('dotenv').config();
const { Client, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');

const db = require('./database');
const conclave = require('./services/conclave');
const { loadCommands, loadInteractionHandlers } = require('./utils/commandLoader');
const { registerCommands } = require('./utils/registerCommands');

// Un fallo suelto no debe tumbar el bot en Railway.
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

// Solo se necesita el gateway básico: todo va por slash commands y botones.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const { commands, skipped } = loadCommands();
client.commands = commands;
client.interactionHandlers = loadInteractionHandlers();
if (skipped.length) console.log(`Módulos desactivados: ${skipped.join(', ')}`);

// ── Healthcheck honesto: 200 solo si Discord y MongoDB responden ─────────────
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    const healthy = client.isReady() && mongoose.connection.readyState === 1;
    res.status(healthy ? 200 : 503).send(healthy ? 'Bot is online!' : 'Bot is starting or degraded');
});
const server = app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// ── Arranque ─────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    try {
        await db.initDb();
        await conclave.ensureIndexes();
    } catch (err) {
        console.error('Database connection failed during startup:', err);
    }

    // Registra los comandos al arrancar: lo que no está activo (p. ej. la tienda) desaparece de Discord.
    try {
        const names = await registerCommands({
            token: (process.env.DISCORD_TOKEN || '').trim(),
            clientId: readyClient.application.id,
            guildId: process.env.GUILD_ID,
            commands: [...client.commands.values()]
        });
        console.log(`Comandos registrados (${names.length}): ${names.join(', ')}`);
    } catch (err) {
        console.error('No se pudieron registrar los comandos:', err);
    }

    // Reanuda escrutinios que quedaron a medias por un reinicio.
    try {
        if (mongoose.connection.readyState === 1) await conclave.recoverConclaves(client);
    } catch (err) {
        console.error('No se pudieron reanudar los cónclaves:', err);
    }
});

client.on('error', error => console.error('Discord.js client error:', error));
client.on('warn', warning => console.warn('Discord.js client warning:', warning));

// ── Interacciones ────────────────────────────────────────────────────────────
async function replyOnce(interaction, content) {
    const payload = { content, flags: MessageFlags.Ephemeral };
    try {
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
    } catch (err) {
        console.warn('No se pudo responder a la interacción (¿expirada?):', err.message);
    }
}

client.on(Events.InteractionCreate, async interaction => {
    const isCommand = interaction.isChatInputCommand();
    const isButton = interaction.isButton();
    if (!isCommand && !isButton) return;

    if (mongoose.connection.readyState !== 1) {
        return replyOnce(interaction, 'La base de datos no está conectada. Inténtalo de nuevo en unos instantes.');
    }

    try {
        if (isCommand) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No matching command found for ${interaction.commandName}.`);
                return;
            }
            await command.execute(interaction);
        } else {
            const handler = client.interactionHandlers.get(interaction.customId.split(':')[0]);
            if (!handler) return;
            await handler.execute(interaction);
        }
    } catch (error) {
        console.error('Execution error:', error);
        await replyOnce(interaction, 'Hubo un error al procesar la solicitud.');
    }
});

// ── Apagado limpio (redeploys de Railway) ────────────────────────────────────
// El estado de los cónclaves vive en MongoDB: un escrutinio interrumpido se reanuda al volver.
let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} recibido, cerrando...`);
    try {
        conclave.cancelPendingRefreshes();
        server.close();
        await client.destroy();
        await mongoose.connection.close();
    } catch (err) {
        console.error('Error durante el apagado:', err);
    } finally {
        process.exit(0);
    }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const token = (process.env.DISCORD_TOKEN || '').trim();
client.login(token)
    .then(() => console.log('Login resuelto.'))
    .catch(err => console.error('LOGIN ERROR (discord.js):', err));
