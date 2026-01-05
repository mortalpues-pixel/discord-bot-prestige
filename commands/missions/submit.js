const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('entregar')
        .setDescription('Envía pruebas de que completaste la misión diaria.')
        .addAttachmentOption(option =>
            option.setName('prueba')
                .setDescription('Sube una captura de pantalla como prueba')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('prueba2')
                .setDescription('Sube una segunda captura (opcional)')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('prueba3')
                .setDescription('Sube una tercera captura (opcional)')
                .setRequired(false)),
    async execute(interaction) {
        const logo = new AttachmentBuilder(config.branding.logoPath);

        const activeMission = await db.getActiveMission();
        if (!activeMission) {
            return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'No hay misión activa para entregar.')], files: [logo], ephemeral: true });
        }

        const attachments = [];
        const prueba1 = interaction.options.getAttachment('prueba');
        if (prueba1) attachments.push(prueba1);

        const prueba2 = interaction.options.getAttachment('prueba2');
        if (prueba2) attachments.push(prueba2);

        const prueba3 = interaction.options.getAttachment('prueba3');
        if (prueba3) attachments.push(prueba3);

        const validAttachments = attachments.filter(a => a.contentType.startsWith('image/'));

        if (validAttachments.length === 0) {
            return interaction.reply({ embeds: [createPremiumEmbed('❌ Error', 'Por favor envía al menos una imagen válida.')], files: [logo], ephemeral: true });
        }

        const proofUrls = validAttachments.map(a => a.url);

        const missionReward = activeMission.is_custom
            ? activeMission.reward
            : (config.missions.find(m => m.key === activeMission.mission_key)?.reward || 0);

        await db.addSubmission(interaction.user.id, activeMission.mission_key, proofUrls, missionReward);

        await interaction.reply({ embeds: [createPremiumEmbed('✅ Entrega Recibida', `Se han recibido **${proofUrls.length}** capturas.\n\nTu prueba está pendiente de aprobación por el Alto Mando.`)], files: [logo], ephemeral: true });
    },
};
