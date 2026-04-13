const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('establecer-diaria')
        .setDescription('Establece manualmente la misión diaria.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('descripcion')
                .setDescription('Descripción de la misión')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('recompensa')
                .setDescription('Puntos de prestigio a otorgar')
                .setRequired(true)),
    async execute(interaction) {
        const logo = new AttachmentBuilder(config.branding.logoPath);

        const highCommandRole = process.env.HIGH_COMMAND_ROLE_ID;
        if (highCommandRole && !interaction.member.roles.cache.has(highCommandRole)) {
            return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No estás autorizado por la familia.')], files: [logo], ephemeral: true });
        }

        const description = interaction.options.getString('descripcion');
        const reward = interaction.options.getInteger('recompensa');

        // Set as "custom" key
        await db.setActiveMission('custom', description, reward);

        const embed = createPremiumEmbed('📅 Misión Diaria Actualizada', '')
            .addFields(
                { name: '📝 Descripción', value: `\`\`\`${description}\`\`\`` },
                { name: '💎 Recompensa', value: `**${reward}** Puntos de Prestigio`, inline: true }
            )
            .setFooter({ text: 'Esta misión está ahora activa y visible para todos.' });

        await interaction.reply({ embeds: [embed], files: [logo] });
    },
};
