require('dotenv').config();
const fs = require('node:fs');

// Global error handling to prevent the bot from "turning off" on Render
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const db = require('./database');
const config = require('./config');
const mongoose = require('mongoose');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is online!');
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    try {
        await db.initDb();
    } catch (err) {
        console.error('Database connection failed during startup:', err);
    }
});

client.on('error', error => {
    console.error('Discord.js client error:', error);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (mongoose.connection.readyState !== 1) {
        try {
            await interaction.reply({
                content: '❌ **Error Crítico**: La base de datos no está conectada. El bot no puede procesar comandos hasta que se restablezca la conexión.',
                flags: 64
            });
        } catch (e) {
            console.error('Failed to send DB error message:', e);
        }
        return;
    }

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No matching command found for ${interaction.commandName}.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Execution error:', error);

        // Final fallback: try to reply if possible, but don't crash if interaction is expired
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Hubo un error al ejecutar este comando!',
                    flags: [64] // 64 is Ephemeral in newer discord.js versions
                });
            } else if (interaction.deferred) {
                await interaction.followUp({
                    content: 'Hubo un error al ejecutar este comando!',
                    flags: [64]
                });
            }
        } catch (innerError) {
            console.warn('Could not send error reply to user (Interaction might have expired/failed):', innerError.message);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
