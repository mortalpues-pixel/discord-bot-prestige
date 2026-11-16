const {
    SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags
} = require('discord.js');
const db = require('../../database.js');
const { isHighCommand } = require('../../utils/permissions.js');
const { createCrownEmbed, sendCourtDM } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('borrar-prestigio')
        .setDescription('Restablece a 0 el prestigio de un miembro.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Miembro cuyo prestigio se restablecerá')
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

        const targetUser = interaction.options.getUser('usuario', true);
        await db.resetUserPrestige(targetUser.id, interaction.user.id);

        const embed = createCrownEmbed({
            title: 'Prestigio Restablecido',
            description: `El prestigio total y semanal de <@${targetUser.id}> ha sido restablecido a **0**.`,
            tone: 'burgundy',
            footer: `Ejecutado por ${interaction.user.tag}`
        });

        await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });

        await sendCourtDM(targetUser, {
            title: 'Prestigio Restablecido',
            description: 'Tu saldo de prestigio total y semanal ha sido restablecido a **0** por orden del Alto Mando.',
            tone: 'burgundy',
            footer: `Emitido por ${interaction.user.tag}`
        });
    }
};
