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
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const userData = await db.getUserData(targetUser.id);
        try {
            const { generateProfileCard } = require('../../utils/cardGenerator.js');
            const cardBuffer = await generateProfileCard(targetUser, userData.prestige, userData.weekly_prestige);
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'profile-card.png' });
            
            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error('Error generating profile card:', error);
            
            // Fallback to classic embed if canvas fails
            const logo = new AttachmentBuilder(config.branding.logoPath);
            const embed = createPremiumEmbed(`🏆 Perfil de Prestigio`, '')
                .addFields(
                    { name: '👤 Usuario', value: `<@${targetUser.id}>`, inline: true },
                    { name: '✨ Puntos Totales', value: `**${userData.prestige}**`, inline: true },
                    { name: '📅 Puntos Semanales', value: `**${userData.weekly_prestige}**`, inline: true }
                );
            await interaction.editReply({ content: '*(Modo ligero - error cargando tarjeta de imagen)*', embeds: [embed], files: [logo] });
        }
    },
};
