const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('historial')
        .setDescription('Muestra el historial de puntos de prestigio de un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario del que ver el historial (Opcional, por defecto tú)')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        const logo = new AttachmentBuilder(config.branding.logoPath);

        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const logs = await db.getPrestigeLogs(targetUser.id, 15); // Get last 15 logs

        if (logs.length === 0) {
            const embed = createPremiumEmbed('📜 Historial de Prestigio', `No hay registros de puntos para <@${targetUser.id}>.`);
            return interaction.editReply({ embeds: [embed], files: [logo] });
        }

        let description = '';
        logs.forEach((log) => {
            const date = new Date(log.timestamp).toLocaleDateString();
            const adminText = log.adminId === 'SYSTEM' ? 'Sistema' : `<@${log.adminId}>`;

            description += `**+${log.amount} pts** — *${log.reason}*\n`;
            description += `📅 ${date} | 👮 Por: ${adminText}\n`;
            description += `─────────────────────\n`;
        });

        const embed = createPremiumEmbed(`📜 Historial de <@${targetUser.id}>`, description)
            .setFooter({ text: 'Mostrando las últimas 15 transacciones.' });

        return interaction.editReply({ embeds: [embed], files: [logo] });
    },
};
