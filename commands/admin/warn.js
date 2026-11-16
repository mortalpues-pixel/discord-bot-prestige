const {
    SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags
} = require('discord.js');
const db = require('../../database.js');
const { isHighCommand } = require('../../utils/permissions.js');
const { createCrownEmbed, sendCourtDM } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advertencia')
        .setDescription('Registro disciplinario de la Corte.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('dar')
                .setDescription('Registra una amonestación sobre un miembro.')
                .addUserOption(option => option.setName('usuario').setDescription('Miembro a amonestar').setRequired(true))
                .addStringOption(option => option.setName('razon').setDescription('Motivo de la amonestación').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Consulta el historial disciplinario de un miembro.')
                .addUserOption(option => option.setName('usuario').setDescription('Miembro a consultar').setRequired(true))),

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

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('usuario', true);

        if (subcommand === 'dar') {
            const reason = interaction.options.getString('razon', true);
            const warningCount = await db.addWarning(targetUser.id, reason, interaction.user.id);

            const embed = createCrownEmbed({
                title: 'Amonestación Registrada',
                description: `Se ha registrado una advertencia oficial sobre <@${targetUser.id}>.`,
                tone: 'burgundy',
                footer: `Emitida por ${interaction.user.tag}`
            }).addFields(
                { name: 'Motivo', value: reason },
                { name: 'Total acumuladas', value: `**${warningCount}**`, inline: true }
            );

            await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });

            await sendCourtDM(targetUser, {
                title: 'Amonestación Oficial',
                description: [
                    'Has recibido una advertencia oficial del Alto Mando.',
                    '',
                    `**Motivo:** ${reason}`,
                    `**Total acumuladas:** ${warningCount}`
                ].join('\n'),
                tone: 'burgundy',
                footer: `Emitida por ${interaction.user.tag}`
            });
            return;
        }

        const warnings = await db.getWarnings(targetUser.id);
        if (warnings.length === 0) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Historial Disciplinario',
                    description: `<@${targetUser.id}> no registra advertencias.`,
                    tone: 'gold'
                })],
                allowedMentions: { parse: [] }
            });
        }

        const recentWarnings = warnings.slice(-10).reverse();
        const embed = createCrownEmbed({
            title: 'Historial Disciplinario',
            description: `Miembro: <@${targetUser.id}> \u00B7 Total: **${warnings.length}**`,
            tone: 'charcoal',
            footer: 'Últimas 10 amonestaciones'
        });

        recentWarnings.forEach((w, i) => {
            const unix = Math.floor(new Date(w.date).getTime() / 1000);
            const modText = /^\d+$/.test(String(w.moderator)) ? `<@${w.moderator}>` : w.moderator;
            embed.addFields({
                name: `Amonestación #${warnings.length - i}`,
                value: `${w.reason}\n<t:${unix}:d> \u00B7 Por ${modText}`
            });
        });

        return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
};
