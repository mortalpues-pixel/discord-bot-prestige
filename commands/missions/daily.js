const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diaria')
        .setDescription('Muestra la misión diaria activa.'),
    async execute(interaction) {
        const logo = new AttachmentBuilder(config.branding.logoPath);
        const activeMission = await db.getActiveMission();

        if (!activeMission) {
            return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No hay misión activa configurada.')], files: [logo] });
        }

        const missionDetails = activeMission.is_custom
            ? { description: activeMission.description, reward: activeMission.reward }
            : config.missions.find(m => m.key === activeMission.mission_key);

        const description = missionDetails ? missionDetails.description : 'Misión desconocida';
        const reward = missionDetails ? missionDetails.reward : 0;

        const embed = createPremiumEmbed('📅 Misión Diaria', '')
            .addFields(
                { name: '📝 Descripción', value: `\`\`\`${description}\`\`\`` },
                { name: '💎 Recompensa', value: `**${reward}** Puntos de Prestigio`, inline: true },
                { name: '🗓️ Fecha', value: activeMission.date_set ? `<t:${Math.floor(new Date(activeMission.date_set).getTime() / 1000)}:R>` : 'Hoy', inline: true }
            )
            .setFooter({ text: 'Usa /entregar para enviar tus pruebas.' });

        await interaction.reply({ embeds: [embed], files: [logo] });
    },
};
