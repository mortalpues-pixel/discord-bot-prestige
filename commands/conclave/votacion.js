const {
    SlashCommandBuilder, InteractionContextType, PermissionFlagsBits, MessageFlags
} = require('discord.js');
const config = require('../../config');
const { isHighCommand } = require('../../utils/permissions');
const conclave = require('../../services/conclave');
const view = require('../../utils/conclaveView');

const { minSeats, maxSeats } = config.conclave;
const ephemeral = MessageFlags.Ephemeral;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('votacion')
        .setDescription('Convoca un cónclave de admisión: votación secreta con bola blanca y bola negra.')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option => option
            .setName('aspirante')
            .setDescription('Persona sobre cuya admisión vota la Corte')
            .setRequired(true))
        .addIntegerOption(option => option
            .setName('votantes')
            .setDescription('Cantidad de votantes convocados a la urna')
            .setRequired(true)
            .setMinValue(minSeats)
            .setMaxValue(maxSeats)),

    async execute(interaction) {
        if (!isHighCommand(interaction.member)) {
            return interaction.reply({
                content: 'Solo el Alto Mando puede convocar un cónclave.',
                flags: ephemeral
            });
        }

        // El panel es público (channel.send); aquí solo se confirma en privado a quien convoca.
        await interaction.deferReply({ flags: ephemeral });

        const user = interaction.options.getUser('aspirante', true);
        const seats = interaction.options.getInteger('votantes', true);

        if (user.bot) {
            return interaction.editReply('Un bot no puede ser aspirante a la Familia.');
        }

        const needed = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
        ];
        if (!interaction.appPermissions || !interaction.appPermissions.has(needed)) {
            return interaction.editReply(
                'No puedo convocar el cónclave en este canal: necesito permisos para ver el canal, enviar mensajes, insertar enlaces y adjuntar archivos.'
            );
        }

        const member = interaction.options.getMember('aspirante');
        const candidate = {
            id: user.id,
            name: member?.displayName ?? user.globalName ?? user.username,
            avatar: (member ?? user).displayAvatarURL({ extension: 'png', size: 256, forceStatic: true })
        };

        const opened = await conclave.openConclave({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            candidate,
            openedBy: interaction.user.id,
            seats
        });

        if (!opened.ok) {
            return interaction.editReply(`**${candidate.name}** ya tiene un cónclave en curso. Espera a que concluya o anúlalo desde su panel.`);
        }

        const { doc } = opened;
        try {
            const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
            const { payload, hasBanner } = await view.openingPayload(doc);
            const message = await channel.send(payload);
            await conclave.attachMessage(doc.voteId, message.id, hasBanner);
        } catch (err) {
            console.error('[conclave] No se pudo publicar el panel:', err);
            await conclave.discard(doc.voteId);
            return interaction.editReply('No he podido publicar el panel del cónclave. No se ha abierto ninguna votación; inténtalo de nuevo.');
        }

        return interaction.editReply(
            `Cónclave **${doc.voteId}** abierto para **${candidate.name}** con ${seats} votantes. Rechazo con ${doc.needed} bolas negras.`
        );
    }
};
