const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../../database.js');
const { createCrownEmbed } = require('../../utils/embeds.js');

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('semanal')
        .setDescription('Muestra el escalafón semanal de mérito.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        await interaction.deferReply();

        const leaderboard = await db.getWeeklyLeaderboard();
        const userData = await db.getUserData(interaction.user.id);
        const myRank = leaderboard.findIndex(u => u.userId === interaction.user.id) + 1;

        const lines = leaderboard.length > 0
            ? leaderboard.slice(0, 10).map((entry, idx) =>
                `**${ROMAN[idx] || idx + 1}.** <@${entry.userId}> \u2014 **+${entry.weekly_prestige}** pts`
            )
            : ['*Aún no se han registrado méritos en la presente semana.*'];

        const personalLine = myRank > 0
            ? `Tu posición: **#${myRank}** \u00B7 **+${userData.weekly_prestige}** pts`
            : 'Tu posición: sin méritos esta semana.';

        const embed = createCrownEmbed({
            title: 'Escalafón Semanal de Mérito',
            description: [...lines, '', personalLine].join('\n'),
            tone: 'gold',
            footer: 'Reinicio semanal cada lunes (UTC)'
        });

        return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
};
