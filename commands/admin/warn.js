const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advertencia')
        .setDescription('Sistema de advertencias para usuarios.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('dar')
                .setDescription('Da una advertencia a un usuario.')
                .addUserOption(option => option.setName('usuario').setDescription('El usuario a advertir').setRequired(true))
                .addStringOption(option => option.setName('razon').setDescription('La razón de la advertencia').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver las advertencias de un usuario.')
                .addUserOption(option => option.setName('usuario').setDescription('El usuario a consultar').setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('usuario');

        // Check High Command Role if strictly needed, but DefaultMemberPermissions handles Discord perms.
        // We can add the role check if the user wants it strictly restricted to "Alto Mando" role ID in .env
        // For now, ManageMessages permission is a good default for mods.

        if (subcommand === 'dar') {
            const reason = interaction.options.getString('razon');

            const warningCount = await db.addWarning(targetUser.id, reason, interaction.user.tag);

            // Try to DM the user
            try {
                const dmEmbed = createPremiumEmbed('⚠️ Advertencia Recibida', `Has recibido una advertencia en el servidor.`)
                    .addFields(
                        { name: 'Razón', value: reason },
                        { name: 'Moderador', value: interaction.user.tag }
                    )
                    .setColor('#FF0000'); // Red
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (e) {
                console.log(`No se pudo enviar DM a ${targetUser.tag} sobre su advertencia.`);
            }

            const embed = createPremiumEmbed('⚠️ Advertencia Agregada', `Se ha advertido a <@${targetUser.id}>.`)
                .addFields(
                    { name: 'Razón', value: reason },
                    { name: 'Total Advertencias', value: `${warningCount}` }
                );

            return interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'ver') {
            const warnings = await db.getWarnings(targetUser.id);

            if (warnings.length === 0) {
                const embed = createPremiumEmbed('✅ Limpio', `<@${targetUser.id}> no tiene advertencias.`);
                return interaction.reply({ embeds: [embed] });
            }

            const embed = createPremiumEmbed('⚠️ Historial de Advertencias', `Usuario: <@${targetUser.id}> - Total: ${warnings.length}`);

            // Limit to last 10 warnings to fit in embed fields
            const recentWarnings = warnings.slice(-10).reverse();

            recentWarnings.forEach((w, i) => {
                const dateStr = new Date(w.date).toLocaleDateString('es-ES');
                embed.addFields({
                    name: `Advertencia #${warnings.length - i} - ${dateStr}`,
                    value: `**Razón:** ${w.reason}\n**Mod:** ${w.moderator}`
                });
            });

            return interaction.reply({ embeds: [embed] });
        }
    },
};
