const {
    SlashCommandBuilder, PermissionFlagsBits, InteractionContextType,
    MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { isHighCommand } = require('../../utils/permissions.js');
const { createCrownEmbed } = require('../../utils/embeds.js');
const {
    prefix,
    buildSubmissionDetailPayload,
    resolveSubmission,
    buildResolutionEmbed
} = require('../../interactions/missions.js');

const ephemeral = MessageFlags.Ephemeral;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aprobar')
        .setDescription('Comandos del Alto Mando para revisar misiones entregadas.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('lista')
                .setDescription('Lista las entregas pendientes con acciones rápidas.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('confirmar')
                .setDescription('Aprueba una entrega específica.')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID de la entrega')
                        .setMinValue(1)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rechazar')
                .setDescription('Rechaza una entrega específica.')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID de la entrega')
                        .setMinValue(1)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('detalles')
                .setDescription('Ver capturas y resolver una entrega.')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID de la entrega')
                        .setMinValue(1)
                        .setRequired(true))),

    async execute(interaction) {
        if (!isHighCommand(interaction.member)) {
            return interaction.reply({
                embeds: [createCrownEmbed({
                    title: 'Acceso Denegado',
                    description: 'No estás autorizado por la Corte.',
                    tone: 'burgundy'
                })],
                flags: ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'lista') {
            await interaction.deferReply({ flags: ephemeral });

            const submissions = await db.getPendingSubmissions();
            if (submissions.length === 0) {
                return interaction.editReply({
                    embeds: [createCrownEmbed({
                        title: 'Entregas Pendientes',
                        description: 'No hay entregas pendientes de revisión.',
                        tone: 'smoke'
                    })]
                });
            }

            const lines = submissions.slice(0, 10).map(s => {
                const mission = config.missions.find(m => m.key === s.mission_key);
                const proofs = Array.isArray(s.proof_content) ? s.proof_content : [s.proof_content];
                const links = proofs
                    .filter(Boolean)
                    .map((url, idx) => `[Prueba ${idx + 1}](${url})`)
                    .join(' \u00B7 ');
                const reward = s.reward_snapshot || mission?.reward || 0;
                const desc = mission ? mission.description : s.mission_key;
                return `**#${s.id}** \u00B7 <@${s.user_id}> \u2014 **${reward} pts**\n${desc} \u00B7 ${links || 'Sin adjuntos'}`;
            });

            const first = submissions[0];
            const extra = submissions.length > 10 ? `\n\nMostrando las primeras 10 de ${submissions.length} entregas.` : '';

            const embed = createCrownEmbed({
                title: 'Entregas Pendientes',
                description: `${lines.join('\n\n')}${extra}`,
                tone: 'charcoal',
                footer: `Acciones rápidas sobre el expediente #${first.id}`
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${prefix}:ok:${first.id}`)
                    .setLabel(`Aprobar #${first.id}`)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`${prefix}:no:${first.id}`)
                    .setLabel(`Rechazar #${first.id}`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`${prefix}:view:${first.id}`)
                    .setLabel(`Ver capturas #${first.id}`)
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.editReply({
                embeds: [embed],
                components: [row],
                allowedMentions: { parse: [] }
            });
        }

        if (subcommand === 'detalles') {
            await interaction.deferReply({ flags: ephemeral });
            const id = interaction.options.getInteger('id', true);
            const submission = await db.getSubmission(id);

            if (!submission) {
                return interaction.editReply({
                    embeds: [createCrownEmbed({
                        title: 'Expediente no encontrado',
                        description: `No se encontró ninguna entrega con el ID **#${id}**.`,
                        tone: 'smoke'
                    })]
                });
            }

            return interaction.editReply(buildSubmissionDetailPayload(submission, { includeActions: true }));
        }

        // confirmar / rechazar
        await interaction.deferReply();
        const id = interaction.options.getInteger('id', true);
        const decision = subcommand === 'confirmar' ? 'approve' : 'reject';
        const res = await resolveSubmission(interaction.client, interaction.user.id, id, decision);

        if (!res.ok) {
            const msg = res.reason === 'missing'
                ? `No se encontró ninguna entrega con el ID **#${id}**.`
                : `La entrega **#${id}** ya está **${res.submission?.status || 'procesada'}**.`;
            return interaction.editReply({
                embeds: [createCrownEmbed({ title: 'Expediente no disponible', description: msg, tone: 'smoke' })]
            });
        }

        const embed = buildResolutionEmbed(id, decision, res.submission, res.reward, interaction.user.id);
        return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
};
