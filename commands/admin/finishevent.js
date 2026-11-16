const {
    SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags
} = require('discord.js');
const db = require('../../database.js');
const { isHighCommand } = require('../../utils/permissions.js');
const { createCrownEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finalizar-evento')
        .setDescription('Concluye una convocatoria y reparte las recompensas a los inscritos.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de la convocatoria a finalizar')
                .setMinValue(1)
                .setRequired(true)),

    async execute(interaction) {
        if (!isHighCommand(interaction.member)) {
            return interaction.reply({
                embeds: [createCrownEmbed({
                    title: 'Acceso Denegado',
                    description: 'No estás autorizado por la Corte.',
                    tone: 'burgundy'
                })],
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        const eventId = interaction.options.getInteger('id', true);
        const event = await db.getEvent(eventId);

        if (!event) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Convocatoria no encontrada',
                    description: `No se encontró ninguna convocatoria con el ID **#${eventId}**.`,
                    tone: 'smoke'
                })]
            });
        }

        if (event.status !== 'open') {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Convocatoria ya cerrada',
                    description: `La convocatoria **#${eventId}** ya había sido concluida.`,
                    tone: 'smoke'
                })]
            });
        }

        const attendees = await db.getEventAttendees(eventId);
        const reward = event.reward || 0;

        const success = await db.updateEventStatus(eventId, 'closed', 'open');
        if (!success) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Convocatoria ya cerrada',
                    description: `La convocatoria **#${eventId}** ya fue cerrada por otro oficial.`,
                    tone: 'smoke'
                })]
            });
        }

        if (attendees.length === 0) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Convocatoria Concluida',
                    description: `La convocatoria **${event.title}** ha cerrado sin participantes registrados.`,
                    tone: 'smoke',
                    footer: `Convocatoria #${eventId}`
                })]
            });
        }

        if (reward === 0) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Convocatoria Concluida',
                    description: `La convocatoria **${event.title}** ha finalizado con **${attendees.length}** inscritos.\nNo había recompensa de prestigio asignada.`,
                    tone: 'charcoal',
                    footer: `Convocatoria #${eventId}`
                })]
            });
        }

        await Promise.all(
            attendees.map(userId =>
                db.addUserPrestige(userId, reward, `Evento: ${event.title}`, interaction.user.id)
            )
        );

        const embed = createCrownEmbed({
            title: 'Convocatoria Concluida',
            description: `Se han asignado recompensas de **${event.title}** a **${attendees.length}** participantes.`,
            tone: 'gold',
            footer: `Convocatoria #${eventId}`
        }).addFields(
            { name: 'Por participante', value: `**+${reward}** pts`, inline: true },
            { name: 'Total asignado', value: `**+${reward * attendees.length}** pts`, inline: true }
        );

        return interaction.editReply({ embeds: [embed] });
    }
};
