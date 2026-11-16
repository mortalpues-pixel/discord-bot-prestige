const {
    SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags
} = require('discord.js');
const db = require('../../database.js');
const { isHighCommand } = require('../../utils/permissions.js');
const { createCrownEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('establecer-diaria')
        .setDescription('Promulga manualmente la misión diaria de la Corte.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('descripcion')
                .setDescription('Descripción del encargo')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('recompensa')
                .setDescription('Puntos de prestigio a otorgar')
                .setMinValue(1)
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

        const description = interaction.options.getString('descripcion', true);
        const reward = interaction.options.getInteger('recompensa', true);

        await db.setActiveMission('custom', description, reward);

        const embed = createCrownEmbed({
            title: 'Encargo del Día Promulgado',
            description: `> ${description}`,
            tone: 'gold',
            footer: 'Encargo activo durante 24 horas'
        }).addFields(
            { name: 'Recompensa', value: `**${reward}** pts`, inline: true }
        );

        return interaction.editReply({ embeds: [embed] });
    }
};
