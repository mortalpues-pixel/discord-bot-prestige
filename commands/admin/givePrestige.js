const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestigio-dar')
        .setDescription('Otorga puntos de prestigio a un usuario (Solo Alto Mando).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario al que dar prestigio')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('La cantidad de puntos a otorgar (puede ser negativo)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón para otorgar estos puntos')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        // 1. Permission Check
        const highCommandRole = process.env.HIGH_COMMAND_ROLE_ID;
        if (highCommandRole && !interaction.member.roles.cache.has(highCommandRole)) {
            return interaction.editReply({
                embeds: [createPremiumEmbed('❌ Acceso Denegado', 'No tienes permisos de Alto Mando para usar este comando.')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('usuario');
        const amount = interaction.options.getInteger('cantidad');
        const reason = interaction.options.getString('razon');

        // 2. Add Prestige (Updates Total, Weekly, and Logs)
        try {
            const newTotal = await db.addUserPrestige(targetUser.id, amount, reason, interaction.user.tag);

            // 3. Response
            const embed = createPremiumEmbed('💎 Prestigio Otorgado', `Se han actualizado los puntos de <@${targetUser.id}>.`)
                .addFields(
                    { name: 'Cantidad', value: `${amount > 0 ? '+' : ''}${amount}`, inline: true },
                    { name: 'Nuevo Total', value: `${newTotal}`, inline: true },
                    { name: 'Razón', value: reason }
                )
                .setColor(amount >= 0 ? '#00FF00' : '#FF0000') // Green for positive, Red for negative
                .setFooter({ text: `Acción realizada por ${interaction.user.tag}` });

            await interaction.editReply({ embeds: [embed] });

            // Optional: DM the user?
            // Usually good practice for admin actions
            try {
                const dmEmbed = createPremiumEmbed('💎 Actualización de Prestigio', `Has recibido ${amount} puntos de prestigio.`)
                    .addFields(
                        { name: 'Razón', value: reason },
                        { name: 'Moderador', value: interaction.user.tag }
                    );
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (err) {
                // Ignore if DM fails
            }

        } catch (error) {
            console.error('Error in prestigio-dar:', error);
            await interaction.editReply({
                embeds: [createPremiumEmbed('❌ Error', 'Hubo un error al actualizar los puntos.')],
                ephemeral: true
            });
        }
    },
};
