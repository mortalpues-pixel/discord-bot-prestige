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
        const safeDescription = String(description).replace(/```/g, "'''");
        const reward = interaction.options.getInteger('recompensa', true);

        await db.setActiveMission('custom', description, reward);

        const embed = createCrownEmbed({
            author: 'CORTE HELMREICH \u00B7 ORDEN DEL D\u00cdA',
            title: 'Misión Diaria Actualizada',
            tone: 'gold',
            footer: 'Esta misión está activa y visible para todos'
        }).addFields(
            { name: '\u25C6 Descripción', value: `\`\`\`\n${safeDescription}\n\`\`\`` },
            { name: '\u25C6 Recompensa', value: `**${reward}** Puntos de Prestigio`, inline: true },
            { name: '\u25C6 Entrega', value: 'Usa `/entregar` con tu captura', inline: true }
        );

        return interaction.editReply({ embeds: [embed] });
    }
};
