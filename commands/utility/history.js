const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../../database.js');
const { createCrownEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('historial')
        .setDescription('Muestra el registro de movimientos de prestigio de un miembro.')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Miembro a consultar (opcional, por defecto tú)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const targetMember = interaction.guild
            ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
            : null;
        const displayName = targetMember?.displayName || targetUser.globalName || targetUser.username;

        const logs = await db.getPrestigeLogs(targetUser.id, 15);

        if (logs.length === 0) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: `Historial \u00B7 ${displayName}`,
                    description: `No constan movimientos de prestigio para <@${targetUser.id}>.`,
                    tone: 'smoke'
                })],
                allowedMentions: { parse: [] }
            });
        }

        const lines = logs.map(log => {
            const sign = log.amount >= 0 ? '+' : '';
            const unix = Math.floor(new Date(log.timestamp).getTime() / 1000);
            const author = log.adminId === 'SYSTEM'
                ? 'Sistema'
                : /^\d+$/.test(String(log.adminId))
                    ? `<@${log.adminId}>`
                    : log.adminId;
            return `**${sign}${log.amount} pts** \u2014 ${log.reason}\n<t:${unix}:d> \u00B7 Por ${author}`;
        });

        const embed = createCrownEmbed({
            title: `Historial \u00B7 ${displayName}`,
            description: lines.join('\n\n'),
            tone: 'charcoal',
            footer: 'Últimos 15 movimientos'
        });

        return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
};
