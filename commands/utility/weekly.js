const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');
const { generateLeaderboardCard } = require('../../utils/cardGenerator.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('semanal')
        .setDescription('Muestra la tabla de clasificación de prestigio semanal.'),
    async execute(interaction) {
        await interaction.deferReply();

        const leaderboard = await db.getWeeklyLeaderboard();
        const userData = await db.getUserData(interaction.user.id);
        const myRank = leaderboard.findIndex(u => u.userId === interaction.user.id) + 1;

        // Keep personal rank textual content
        let description = '';
        if (myRank > 0) {
            description += `**Tu posición en el ranking:** #${myRank} — **${userData.weekly_prestige}** pts`;
        } else {
            description += `**Tu posición en el ranking:** — (0 pts esta semana)`;
        }

        const embed = createPremiumEmbed('🏆 Ranking Semanal', description);
        embed.setFooter({ text: 'El prestigio semanal se reinicia automáticamente cada Lunes.' });

        const top5 = leaderboard.slice(0, 5);
        const topUsersData = [];

        for (const entry of top5) {
            try {
                const userObj = await interaction.client.users.fetch(entry.userId);
                topUsersData.push({ user: userObj, prestige: entry.weekly_prestige });
            } catch (e) {
                console.warn(`Could not fetch user ${entry.userId}:`, e.message);
            }
        }

        try {
            const cardBuffer = await generateLeaderboardCard(topUsersData);
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'leaderboard.png' });
            
            embed.setImage('attachment://leaderboard.png');
            return interaction.editReply({ embeds: [embed], files: [attachment] });
        } catch (err) {
            console.error('Error generating leaderboard image:', err);
            // Fallback if canvas fails
            embed.setDescription(description + '\n\n*(Error cargando la imagen del top visual)*');
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
