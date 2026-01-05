const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('borrar-prestigio')
        .setDescription('Resetea el prestigio de un usuario a 0.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario al que borrar el prestigio')
                .setRequired(true)),
    async execute(interaction) {
        const logo = new AttachmentBuilder(config.branding.logoPath);

        const highCommandRole = process.env.HIGH_COMMAND_ROLE_ID;
        if (highCommandRole && !interaction.member.roles.cache.has(highCommandRole)) {
            return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No tienes permiso (Alto Mando) para usar esto.')], files: [logo], ephemeral: true });
        }

        const targetUser = interaction.options.getUser('usuario');

        await db.resetUserPrestige(targetUser.id);

        const embed = createPremiumEmbed('🗑️ Prestigio Borrado', `El prestigio de <@${targetUser.id}> ha sido reseteado a **0**.`)
            .setFooter({ text: 'Acción realizada por un Alto Mando.' });

        await interaction.reply({ embeds: [embed], files: [logo] });
    },
};
