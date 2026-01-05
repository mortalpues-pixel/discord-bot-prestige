const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('semanal')
        .setDescription('Muestra la tabla de clasificación de prestigio semanal.'),
    async execute(interaction) {
        await interaction.deferReply();

        const leaderboard = await db.getWeeklyLeaderboard();
        const userData = await db.getUserData(interaction.user.id);
        const myRank = leaderboard.findIndex(u => u.userId === interaction.user.id) + 1;

        let description = 'Los usuarios con más prestigio obtenido esta semana (reinicia el Lunes).\n\n';

        if (leaderboard.length === 0) {
            description += '_Nadie ha ganado prestigio esta semana todavía._';
        } else {
            leaderboard.forEach((user, index) => {
                let medal = '';
                if (index === 0) medal = '🥇 ';
                if (index === 1) medal = '🥈 ';
                if (index === 2) medal = '🥉 ';
                if (index > 2) medal = `**${index + 1}.** `;

                description += `${medal}<@${user.userId}> — **${user.weekly_prestige}** pts\n`;
            });
        }

        description += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
        if (myRank > 0) {
            description += `**Tu posición:** #${myRank} — **${userData.weekly_prestige}** pts`;
        } else {
            description += `**Tu posición:** — (0 pts esta semana)`;
        }

        const embed = createPremiumEmbed('🏆 Ranking Semanal', description);

        // Optional: Add footer explaining the reset
        embed.setFooter({ text: 'El prestigio semanal se reinicia automáticamente cada Lunes.' });

        return interaction.editReply({ embeds: [embed] });
    },
};
