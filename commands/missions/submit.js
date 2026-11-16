const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createCrownEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('entregar')
        .setDescription('Presenta pruebas de haber completado la misión diaria.')
        .setContexts(InteractionContextType.Guild)
        .addAttachmentOption(option =>
            option.setName('prueba')
                .setDescription('Captura de pantalla como prueba')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('prueba2')
                .setDescription('Segunda captura (opcional)')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('prueba3')
                .setDescription('Tercera captura (opcional)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const activeMission = await db.getActiveMission();
        if (!activeMission) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Sin Encargo Activo',
                    description: 'No hay ninguna misión activa para entregar en este momento.',
                    tone: 'smoke'
                })]
            });
        }

        const attachments = [
            interaction.options.getAttachment('prueba'),
            interaction.options.getAttachment('prueba2'),
            interaction.options.getAttachment('prueba3')
        ].filter(Boolean);

        const validAttachments = attachments.filter(
            a => typeof a.contentType === 'string' && a.contentType.startsWith('image/')
        );

        if (validAttachments.length === 0) {
            return interaction.editReply({
                embeds: [createCrownEmbed({
                    title: 'Prueba no válida',
                    description: 'Adjunta al menos una imagen válida (PNG, JPG o WEBP).',
                    tone: 'burgundy'
                })]
            });
        }

        const proofUrls = validAttachments.map(a => a.url);
        const missionReward = activeMission.is_custom
            ? Number(activeMission.reward) || 0
            : (config.missions.find(m => m.key === activeMission.mission_key)?.reward || 0);

        const submissionId = await db.addSubmission(
            interaction.user.id,
            activeMission.mission_key,
            proofUrls,
            missionReward
        );

        const embed = createCrownEmbed({
            title: `Entrega Registrada \u00B7 #${submissionId}`,
            description: [
                `Se han recibido **${proofUrls.length}** captura(s) para su revisión.`,
                '',
                'El Alto Mando evaluará el expediente a la mayor brevedad.'
            ].join('\n'),
            tone: 'gold',
            footer: `Recompensa asignada: ${missionReward} pts`
        });

        return interaction.editReply({ embeds: [embed] });
    }
};
