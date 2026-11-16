const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createCrownEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diaria')
        .setDescription('Muestra la misión diaria activa.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        await interaction.deferReply();

        const activeMission = await db.getActiveMission();
        if (!activeMission) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Misión Diaria',
                    description: 'No hay ningún encargo activo en este momento.',
                    tone: 'smoke'
                })]
            });
        }

        const missionDetails = activeMission.is_custom
            ? { description: activeMission.description, reward: activeMission.reward }
            : config.missions.find(m => m.key === activeMission.mission_key);

        const description = missionDetails ? missionDetails.description : 'Encargo sin descripción.';
        const reward = missionDetails ? missionDetails.reward : 0;
        const setUnix = activeMission.date_set
            ? Math.floor(new Date(activeMission.date_set).getTime() / 1000)
            : null;

        const embed = createCrownEmbed({
            title: 'Encargo del Día',
            description: `> ${description}`,
            tone: 'gold',
            footer: 'Usa /entregar para presentar tus pruebas'
        }).addFields(
            { name: 'Recompensa', value: `**${reward}** pts`, inline: true },
            { name: 'Publicado', value: setUnix ? `<t:${setUnix}:R>` : 'Hoy', inline: true }
        );

        return interaction.editReply({ embeds: [embed] });
    }
};
