const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

/**
 * Carga los comandos de /commands/<modulo>/*.js saltándose los módulos desactivados
 * en config.disabledModules. Lo comparten index.js y deploy-commands.js para que lo que
 * corre y lo que se registra en Discord sea siempre lo mismo.
 */
function loadCommands(options = {}) {
    const disabled = new Set(options.disabledModules ?? config.disabledModules ?? []);
    const root = options.root ?? path.join(__dirname, '..', 'commands');

    const commands = new Map();
    const skipped = [];

    for (const folder of fs.readdirSync(root)) {
        const folderPath = path.join(root, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        if (disabled.has(folder)) {
            skipped.push(folder);
            continue;
        }

        for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.set(command.data.name, command);
            } else {
                console.warn(`[WARNING] El comando ${filePath} no tiene "data" o "execute".`);
            }
        }
    }

    return { commands, skipped };
}

/**
 * Carga los manejadores de componentes (botones...) de /interactions/*.js.
 * Cada archivo exporta { prefix, execute(interaction) } y se enruta por el prefijo del customId.
 */
function loadInteractionHandlers(root = path.join(__dirname, '..', 'interactions')) {
    const handlers = new Map();
    if (!fs.existsSync(root)) return handlers;

    for (const file of fs.readdirSync(root).filter(f => f.endsWith('.js'))) {
        const handler = require(path.join(root, file));
        if (handler.prefix && typeof handler.execute === 'function') {
            handlers.set(handler.prefix, handler);
        } else {
            console.warn(`[WARNING] El manejador ${file} no exporta "prefix" y "execute".`);
        }
    }
    return handlers;
}

module.exports = { loadCommands, loadInteractionHandlers };
