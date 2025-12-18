const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed, createProgressBar } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestigio')
        .setDescription('Muestra el nivel de prestigio.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver el prestigio de otro usuario (opcional)')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const prestige = await db.getUserPrestige(targetUser.id);
        const logo = new AttachmentBuilder(config.branding.logoPath);

        const embed = createPremiumEmbed(`🏆 Perfil de Prestigio`, '')
            .addFields(
                { name: '👤 Usuario', value: `<@${targetUser.id}>`, inline: true },
                { name: '✨ Puntos Totales', value: `**${prestige}**`, inline: true }
            );

        await interaction.reply({ embeds: [embed], files: [logo] });
    },
};
