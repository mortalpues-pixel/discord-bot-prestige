const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../database.js');
const { createCrownEmbed } = require('../utils/embeds.js');

const PREFIX = 'ev';
const ephemeral = MessageFlags.Ephemeral;

function buildEventAnnouncementPayload(event) {
    const count = Array.isArray(event.attendees) ? event.attendees.length : 0;
    const isOpen = event.status === 'open';
    const safeDesc = event.description
        ? `\`\`\`\n${String(event.description).replace(/```/g, "'''")}\n\`\`\``
        : undefined;

    const embed = createCrownEmbed({
        title: `Convocatoria \u00B7 ${event.title}`,
        description: safeDesc,
        tone: isOpen ? 'gold' : 'smoke',
        footer: `Convocatoria #${event.id}`
    }).addFields(
        { name: '\u25C6 Fecha y hora', value: `**${event.date_time}**`, inline: true },
        { name: '\u25C6 Recompensa', value: `**${event.reward || 0}** Puntos de Prestigio`, inline: true },
        { name: '\u25C6 Inscritos', value: `**${count}**`, inline: true }
    );

    const components = [];
    if (isOpen) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${PREFIX}:join:${event.id}`)
                    .setLabel('Inscribirse')
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    }

    return { embeds: [embed], components };
}

async function execute(interaction) {
    const [, action, rawId] = interaction.customId.split(':');
    if (action !== 'join') return undefined;

    const eventId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(eventId)) return undefined;

    await interaction.deferReply({ flags: ephemeral });

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
        try {
            if (interaction.message) {
                await interaction.message.edit({
                    ...buildEventAnnouncementPayload(event),
                    allowedMentions: { parse: [] }
                });
            }
        } catch { /* noop */ }

        return interaction.editReply({
            embeds: [createCrownEmbed({
                title: 'Registro Cerrado',
                description: `La convocatoria **#${eventId}** ya ha concluido y no admite inscripciones.`,
                tone: 'smoke'
            })]
        });
    }

    const added = await db.registerForEvent(eventId, interaction.user.id);
    if (!added) {
        return interaction.editReply({
            embeds: [createCrownEmbed({
                title: 'Inscripción Existente',
                description: `Ya figuras en la lista de inscritos de la convocatoria **#${eventId}**.`,
                tone: 'charcoal'
            })]
        });
    }

    await interaction.editReply({
        embeds: [createCrownEmbed({
            title: 'Inscripción Confirmada',
            description: `Has quedado inscrito en la convocatoria **#${eventId}**.`,
            tone: 'gold'
        })]
    });

    try {
        const updated = await db.getEvent(eventId);
        if (updated && interaction.message) {
            await interaction.message.edit({
                ...buildEventAnnouncementPayload(updated),
                allowedMentions: { parse: [] }
            });
        }
    } catch { /* noop */ }
}

module.exports = {
    prefix: PREFIX,
    execute,
    buildEventAnnouncementPayload
};
