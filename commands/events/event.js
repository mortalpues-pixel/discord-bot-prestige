const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const db = require('../../database.js');
const { isHighCommand } = require('../../utils/permissions.js');
const { createCrownEmbed } = require('../../utils/embeds.js');
const { buildEventAnnouncementPayload } = require('../../interactions/events.js');

const ephemeral = MessageFlags.Ephemeral;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evento')
        .setDescription('Sistema de convocatorias y eventos de la Corte.')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('anunciar')
                .setDescription('Anuncia una nueva convocatoria.')
                .addStringOption(option => option.setName('titulo').setDescription('Título del evento').setRequired(true))
                .addStringOption(option => option.setName('descripcion').setDescription('Descripción del evento').setRequired(true))
                .addStringOption(option => option.setName('fecha').setDescription('Fecha y hora del evento').setRequired(true))
                .addIntegerOption(option =>
                    option.setName('recompensa')
                        .setDescription('Puntos de prestigio por asistir')
                        .setMinValue(0)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('registrarse')
                .setDescription('Inscribirse en una convocatoria abierta.')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID de la convocatoria (opcional, por defecto la última)')
                        .setMinValue(1)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('participantes')
                .setDescription('Ver lista de inscritos (Alto Mando).')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID de la convocatoria (opcional, por defecto la última)')
                        .setMinValue(1)
                        .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'anunciar') {
            if (!isHighCommand(interaction.member)) {
                return interaction.reply({
                    embeds: [createCrownEmbed({
                        title: 'Acceso Denegado',
                        description: 'No estás autorizado por la Corte.',
                        tone: 'burgundy'
                    })],
                    flags: ephemeral
                });
            }

            await interaction.deferReply();

            const title = interaction.options.getString('titulo', true);
            const description = interaction.options.getString('descripcion', true);
            const date = interaction.options.getString('fecha', true);
            const reward = interaction.options.getInteger('recompensa') || 0;

            const result = await db.createEvent(title, description, date, interaction.user.id, reward);
            const eventId = result.lastInsertRowid;

            const payload = buildEventAnnouncementPayload({
                id: eventId,
                title,
                description,
                date_time: date,
                reward,
                status: 'open',
                attendees: []
            });

            return interaction.editReply({
                content: '@everyone',
                ...payload,
                allowedMentions: { parse: ['everyone'] }
            });
        }

        if (subcommand === 'participantes') {
            if (!isHighCommand(interaction.member)) {
                return interaction.reply({
                    embeds: [createCrownEmbed({
                        title: 'Acceso Denegado',
                        description: 'No estás autorizado por la Corte.',
                        tone: 'burgundy'
                    })],
                    flags: ephemeral
                });
            }

            await interaction.deferReply({ flags: ephemeral });

            let eventId = interaction.options.getInteger('id');
            if (!eventId) {
                const events = await db.getEvents();
                if (events.length === 0) {
                    return interaction.editReply({
                        embeds: [createCrownEmbed({
                            title: 'Sin Convocatorias',
                            description: 'No hay convocatorias registradas.',
                            tone: 'smoke'
                        })]
                    });
                }
                eventId = events[0].id;
            }

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

            const attendeesIds = event.attendees || [];
            if (attendeesIds.length === 0) {
                return interaction.editReply({
                    embeds: [createCrownEmbed({
                        title: `Inscritos \u00B7 Convocatoria #${eventId}`,
                        description: 'Todavía no hay miembros inscritos.',
                        tone: 'charcoal'
                    })]
                });
            }

            const lines = [];
            let charCount = 0;
            let omitted = 0;
            for (let i = 0; i < attendeesIds.length; i++) {
                const line = `**${i + 1}.** <@${attendeesIds[i]}>`;
                if (charCount + line.length + 1 > 3800) {
                    omitted = attendeesIds.length - i;
                    break;
                }
                lines.push(line);
                charCount += line.length + 1;
            }
            if (omitted > 0) lines.push(`\n*...y ${omitted} inscritos más.*`);

            const embed = createCrownEmbed({
                title: `Inscritos \u00B7 Convocatoria #${eventId}`,
                description: `Total: **${attendeesIds.length}**\n\n${lines.join('\n')}`,
                tone: 'charcoal',
                footer: event.title
            });

            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        }

        // registrarse
        await interaction.deferReply({ flags: ephemeral });

        let eventId = interaction.options.getInteger('id');
        if (!eventId) {
            const events = await db.getEvents();
            const openEvents = events.filter(e => e.status === 'open');
            if (openEvents.length === 0) {
                return interaction.editReply({
                    embeds: [createCrownEmbed({
                        title: 'Sin Convocatorias',
                        description: 'No hay convocatorias abiertas en este momento.',
                        tone: 'smoke'
                    })]
                });
            }
            eventId = openEvents[0].id;
        }

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
                    title: 'Registro Cerrado',
                    description: `La convocatoria **#${eventId}** ya ha concluido.`,
                    tone: 'smoke'
                })]
            });
        }

        const added = await db.registerForEvent(eventId, interaction.user.id);
        if (added) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Inscripción Confirmada',
                    description: `Has quedado inscrito en la convocatoria **#${eventId}**.`,
                    tone: 'gold'
                })]
            });
        }
        return interaction.editReply({
            embeds: [createCrownEmbed({
                title: 'Inscripción Existente',
                description: `Ya figuras en la lista de inscritos de la convocatoria **#${eventId}**.`,
                tone: 'charcoal'
            })]
        });
    }
};
