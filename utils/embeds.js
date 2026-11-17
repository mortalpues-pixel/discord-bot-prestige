const { EmbedBuilder } = require('discord.js');
const crown = require('./crown');

/**
 * Crea un embed sobrio acorde a la estética de la Corte Helmreich.
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {string} [opts.description]
 * @param {'gold'|'charcoal'|'burgundy'|'smoke'|'obsidian'} [opts.tone='gold']
 * @param {string|null} [opts.footer=null]
 * @param {boolean} [opts.timestamp=true]
 * @param {boolean} [opts.thumbnail=true]
 * @param {string|null} [opts.author=null]
 * @returns {EmbedBuilder}
 */
function createCrownEmbed({
    title,
    description,
    tone = 'gold',
    footer = null,
    timestamp = true,
    thumbnail = true,
    author = null
} = {}) {
    const color = crown.colors[tone] ?? crown.colors.gold;
    const embed = new EmbedBuilder()
        .setColor(color)
        .setFooter({ text: footer ? `${footer} · ${crown.house}` : crown.house });

    if (author) embed.setAuthor({ name: author, iconURL: crown.crestUrl });
    if (thumbnail) embed.setThumbnail(crown.crestUrl);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (timestamp) embed.setTimestamp();

    return embed;
}

/** Wrapper de compatibilidad hacia createCrownEmbed. */
function createPremiumEmbed(title, description, opts = {}) {
    return createCrownEmbed({ title, description, ...opts });
}

/** Envía un aviso privado por MD con el formato de la Corte; ignora si el usuario tiene MDs cerrados. */
async function sendCourtDM(user, embedOptions) {
    if (!user || typeof user.send !== 'function') return false;
    try {
        await user.send({ embeds: [createCrownEmbed(embedOptions)] });
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    createCrownEmbed,
    createPremiumEmbed,
    sendCourtDM
};
