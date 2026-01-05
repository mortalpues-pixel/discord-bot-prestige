const { EmbedBuilder } = require('discord.js');
const config = require('../config.js');

/**
 * Creates a "Premium" styled embed with consistent branding.
 * @param {string} title - The title of the embed.
 * @param {string} description - The description/body of the embed.
 * @returns {EmbedBuilder} - The configured embed instance.
 */
function createPremiumEmbed(title, description) {
    const embed = new EmbedBuilder()
        .setColor(config.branding.color) // White (0xFFFFFF)
        .setTitle(title)
        .setThumbnail('attachment://logo.png')
        .setTimestamp() // Adds date/time at the bottom
        .setFooter({
            text: 'Sistema de Misiones',
        });

    if (description && description.length > 0) {
        embed.setDescription(description);
    }

    return embed;
}

/**
 * Generates a text-based progress bar.
 * @param {number} current - Current value.
 * @param {number} max - Max value (for percentage).
 * @param {number} length - Number of blocks in the bar.
 * @returns {string} - The progress bar string.
 */
function createProgressBar(current, max, length = 10) {
    const percentage = Math.min(Math.max(current / max, 0), 1);
    const progress = Math.round(length * percentage);
    const emptyProgress = length - progress;

    const progressText = '█'.repeat(progress);
    const emptyProgressText = '░'.repeat(emptyProgress);

    return `[${progressText}${emptyProgressText}]`;
}

module.exports = {
    createPremiumEmbed,
    createProgressBar
};
