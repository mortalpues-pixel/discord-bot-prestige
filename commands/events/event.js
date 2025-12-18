const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evento')
        .setDescription('Sistema de eventos.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('anunciar')
                .setDescription('Anuncia un nuevo evento.')
                .addStringOption(option => option.setName('titulo').setDescription('Título del evento').setRequired(true))
                .addStringOption(option => option.setName('descripcion').setDescription('Descripción del evento').setRequired(true))
                .addStringOption(option => option.setName('fecha').setDescription('Fecha y hora del evento').setRequired(true))
                .addIntegerOption(option => option.setName('recompensa').setDescription('Puntos de prestigio por asistir').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('registrarse')
                .setDescription('Registrarse en un evento')
                .addIntegerOption(option => option.setName('id').setDescription('ID del evento (opcional, por defecto el último)').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('participantes')
                .setDescription('Ver lista de participantes (Alto Mando)')
                .addIntegerOption(option => option.setName('id').setDescription('ID del evento (opcional, por defecto el último)').setRequired(false))),
    async execute(interaction) {
        const logo = new AttachmentBuilder(config.branding.logoPath);
        const { createPremiumEmbed } = require('../../utils/embeds.js');

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'anunciar') {
            const highCommandRole = process.env.HIGH_COMMAND_ROLE_ID;
            if (highCommandRole && !interaction.member.roles.cache.has(highCommandRole)) {
                return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No tienes permiso para anunciar eventos.')], files: [logo], ephemeral: true });
            }

            const title = interaction.options.getString('titulo');
            const description = interaction.options.getString('descripcion');
            const date = interaction.options.getString('fecha');
            const reward = interaction.options.getInteger('recompensa') || 0;

            const result = await db.createEvent(title, description, date, interaction.user.id, reward);
            const eventId = result.lastInsertRowid;

            const embed = createPremiumEmbed(`📢 Nuevo Evento: ${title}`, description)
                .addFields(
                    { name: '🗓️ Fecha/Hora', value: `**${date}**`, inline: true },
                    { name: '💎 Recompensa', value: `**${reward}** Puntos`, inline: true },
                    { name: '🆔 ID del Evento', value: `\`${eventId}\``, inline: true }
                )
                .setFooter({ text: 'Usa /evento registrarse para apuntarte.' });

            await interaction.reply({ content: '@everyone', embeds: [embed], files: [logo] });

        } else if (subcommand === 'participantes') {
            const highCommandRole = process.env.HIGH_COMMAND_ROLE_ID;
            if (highCommandRole && !interaction.member.roles.cache.has(highCommandRole)) {
                return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No tienes permiso para ver los participantes.')], files: [logo], ephemeral: true });
            }

            let eventId = interaction.options.getInteger('id');

            if (!eventId) {
                const events = await db.getEvents();
                if (events.length > 0) {
                    eventId = events[0].id;
                } else {
                    return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No hay eventos activos.')], files: [logo], ephemeral: true });
                }
            }

            const attendeesIds = await db.getEventAttendees(eventId);

            if (attendeesIds.length === 0) {
                return interaction.reply({ embeds: [createPremiumEmbed(`👥 Participantes Evento #${eventId}`, 'No hay nadie registrado aún.')], files: [logo], ephemeral: true });
            }

            const attendeesList = attendeesIds.map((id, index) => `**${index + 1}.** <@${id}>`).join('\n');
            const embed = createPremiumEmbed(`👥 Participantes Evento #${eventId}`, `Total: **${attendeesIds.length}**\n\n${attendeesList}`);

            await interaction.reply({ embeds: [embed], files: [logo], ephemeral: true });

        } else if (subcommand === 'registrarse') {
            let eventId = interaction.options.getInteger('id');

            if (!eventId) {
                const events = await db.getEvents();
                // Filter for open events if possible, or just pick first
                const openEvents = events.filter(e => e.status !== 'closed');
                if (openEvents.length > 0) {
                    eventId = openEvents[0].id;
                } else {
                    return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No hay eventos activos.')], files: [logo], ephemeral: true });
                }
            }

            // Check if event is actually open
            const event = await db.getEvent(eventId);
            if (!event) {
                return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'Evento no encontrado.')], files: [logo], ephemeral: true });
            }
            if (event.status === 'closed') {
                return interaction.reply({ embeds: [createPremiumEmbed('⚠️ Aviso', 'Este evento ya ha finalizado.')], files: [logo], ephemeral: true });
            }

            try {
                const success = await db.registerForEvent(eventId, interaction.user.id);
                if (success) {
                    await interaction.reply({ embeds: [createPremiumEmbed('✅ Registro Exitoso', `Te has registrado correctamente al evento **#${eventId}**.`)], files: [logo], ephemeral: true });
                } else {
                    await interaction.reply({ embeds: [createPremiumEmbed('⚠️ Aviso', `Ya estás registrado en el evento **#${eventId}**.`)], files: [logo], ephemeral: true });
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'Error al registrarte. Verifica el ID del evento.')], files: [logo], ephemeral: true });
            }
        }
    },
};
