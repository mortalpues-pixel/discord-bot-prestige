const {
    SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags
} = require('discord.js');
const db = require('../../database.js');
const { isHighCommand } = require('../../utils/permissions.js');
const { createCrownEmbed, sendCourtDM } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestigio-dar')
        .setDescription('Ajusta los puntos de prestigio de un miembro (Alto Mando).')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Miembro cuyo prestigio se ajusta')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Puntos a sumar o restar (admite valores negativos)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('Motivo del ajuste')
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
        const amount = interaction.options.getInteger('cantidad', true);
        const reason = interaction.options.getString('razon', true);

        const newTotal = await db.addUserPrestige(targetUser.id, amount, reason, interaction.user.id);
        const tone = amount >= 0 ? 'gold' : 'burgundy';
        const delta = `${amount >= 0 ? '+' : ''}${amount}`;

        const embed = createCrownEmbed({
            title: 'Ajuste de Prestigio',
            description: `Se ha actualizado el expediente de <@${targetUser.id}>.`,
            tone,
            footer: `Ejecutado por ${interaction.user.tag}`
        }).addFields(
            { name: 'Variación', value: `**${delta}** pts`, inline: true },
            { name: 'Total actual', value: `**${newTotal}** pts`, inline: true },
            { name: 'Motivo', value: reason }
        );

        await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });

        await sendCourtDM(targetUser, {
            title: 'Ajuste de Prestigio',
            description: [
                `Tu prestigio ha sido ajustado en **${delta} pts**.`,
                '',
                `**Motivo:** ${reason}`,
                `**Saldo actual:** ${newTotal} pts`
            ].join('\n'),
            tone,
            footer: `Emitido por ${interaction.user.tag}`
        });
    }
};
