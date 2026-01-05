const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finalizar-evento')
        .setDescription('Finaliza un evento y reparte las recompensas a los asistentes.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID del evento a finalizar')
                .setRequired(true)),
    async execute(interaction) {
        const logo = new AttachmentBuilder(config.branding.logoPath);

        const highCommandRole = process.env.HIGH_COMMAND_ROLE_ID;
        if (highCommandRole && !interaction.member.roles.cache.has(highCommandRole)) {
            return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No tienes permiso (Alto Mando) para usar esto.')], files: [logo], ephemeral: true });
        }

        const eventId = interaction.options.getInteger('id');
        const event = await db.getEvent(eventId);

        if (!event) {
            return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No se encontró un evento con ese ID.')], files: [logo], ephemeral: true });
        }

        if (event.status === 'closed') {
            return interaction.reply({ embeds: [createPremiumEmbed('⚠️ Aviso', 'Este evento ya ha sido finalizado.')], files: [logo], ephemeral: true });
        }

        const attendees = await db.getEventAttendees(eventId);
        const reward = event.reward || 0;

        if (attendees.length === 0) {
            await db.updateEventStatus(eventId, 'closed');
            return interaction.reply({ embeds: [createPremiumEmbed('🏁 Evento Finalizado', 'El evento se cerró, pero no había participantes registrados.')], files: [logo] });
        }

        if (reward === 0) {
            await db.updateEventStatus(eventId, 'closed');
            return interaction.reply({ embeds: [createPremiumEmbed('🏁 Evento Finalizado', `Evento finalizado con **${attendees.length}** participantes.\nNo había recompensa configurada.`)], files: [logo] });
        }

        // Distribute Rewards
        let count = 0;
        for (const userId of attendees) {
            await db.addUserPrestige(userId, reward);
            count++;
        }

        await db.updateEventStatus(eventId, 'closed');

        const embed = createPremiumEmbed('🏁 Evento Finalizado', `Se han repartido recompensas a **${count}** participantes.`)
            .addFields(
                { name: '💎 Recompensa por Persona', value: `**${reward}** Puntos`, inline: true },
                { name: '👥 Total Repartido', value: `**${reward * count}** Puntos`, inline: true }
            );

        await interaction.reply({ embeds: [embed], files: [logo] });
    },
};
