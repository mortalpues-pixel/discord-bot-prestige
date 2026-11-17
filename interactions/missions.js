const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags
} = require('discord.js');
const db = require('../database.js');
const config = require('../config.js');
const crown = require('../utils/crown.js');
const { isHighCommand } = require('../utils/permissions.js');
const { createCrownEmbed, sendCourtDM } = require('../utils/embeds.js');

const PREFIX = 'ms';
const ephemeral = MessageFlags.Ephemeral;

function buildSubmissionDetailPayload(submission, { includeActions = true } = {}) {
    const mission = config.missions.find(m => m.key === submission.mission_key);
    const rawProofs = Array.isArray(submission.proof_content)
        ? submission.proof_content
        : [submission.proof_content];
    const proofs = rawProofs.filter(Boolean);
    const reward = submission.reward_snapshot || mission?.reward || 10;

    const tone = submission.status === 'approved'
        ? 'gold'
        : submission.status === 'rejected'
            ? 'burgundy'
            : 'charcoal';
    const statusText = submission.status === 'approved'
        ? 'Aprobada'
        : submission.status === 'rejected'
            ? 'Rechazada'
            : 'Pendiente';

    const mainEmbed = createCrownEmbed({
        title: `Expediente #${submission.id}`,
        description: `Miembro: <@${submission.user_id}>\nEncargo: ${mission ? mission.description : submission.mission_key}`,
        tone,
        footer: `Estado: ${statusText}`
    }).addFields(
        { name: '\u25C6 Estado', value: statusText, inline: true },
        { name: '\u25C6 Recompensa', value: `**${reward}** Puntos de Prestigio`, inline: true },
        { name: '\u25C6 Pruebas', value: `${proofs.length} captura(s)`, inline: true }
    );

    const embeds = [mainEmbed];
    proofs.slice(0, 10).forEach((url, index) => {
        if (index === 0) {
            mainEmbed.setImage(url);
        } else {
            embeds.push(
                new EmbedBuilder()
                    .setColor(crown.colors.obsidian)
                    .setImage(url)
            );
        }
    });

    const components = [];
    if (includeActions && submission.status === 'pending') {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${PREFIX}:ok:${submission.id}`)
                    .setLabel('Aprobar')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`${PREFIX}:no:${submission.id}`)
                    .setLabel('Rechazar')
                    .setStyle(ButtonStyle.Danger)
            )
        );
    }

    return { embeds, components, allowedMentions: { parse: [] } };
}

async function resolveSubmission(client, adminUserId, id, decision) {
    const existing = await db.getSubmission(id);
    if (!existing) return { ok: false, reason: 'missing' };
    if (existing.status !== 'pending') {
        return { ok: false, reason: 'already', submission: existing };
    }

    const targetStatus = decision === 'approve' ? 'approved' : 'rejected';
    const updated = await db.updateSubmissionStatus(id, targetStatus, 'pending');
    if (!updated) {
        return { ok: false, reason: 'already', submission: await db.getSubmission(id) };
    }

    const mission = config.missions.find(m => m.key === updated.mission_key);
    const reward = updated.reward_snapshot || mission?.reward || 10;

    let user = null;
    try {
        user = await client.users.fetch(updated.user_id);
    } catch {
        user = null;
    }

    if (decision === 'approve') {
        await db.addUserPrestige(
            updated.user_id,
            reward,
            `Misión Aprobada: ${updated.mission_key}`,
            adminUserId
        );
        await sendCourtDM(user, {
            title: 'Encargo Aprobado',
            description: `Tu entrega **#${id}** ha sido aprobada.\nHas recibido **+${reward}** puntos de prestigio.`,
            tone: 'gold',
            footer: 'Misiones de la Corte'
        });
    } else {
        await sendCourtDM(user, {
            title: 'Encargo Rechazado',
            description: `Tu entrega **#${id}** no ha superado la revisión del Alto Mando.`,
            tone: 'burgundy',
            footer: 'Misiones de la Corte'
        });
    }

    return { ok: true, submission: updated, reward };
}

function buildResolutionEmbed(id, decision, submission, reward, adminUserId) {
    if (decision === 'approve') {
        return createCrownEmbed({
            title: `Entrega #${id} Aprobada`,
            description: `Se han asignado **+${reward}** puntos a <@${submission.user_id}>.\nResuelto por <@${adminUserId}>.`,
            tone: 'gold',
            footer: 'Revisión completada'
        });
    }
    return createCrownEmbed({
        title: `Entrega #${id} Rechazada`,
        description: `La entrega de <@${submission.user_id}> ha sido rechazada.\nResuelto por <@${adminUserId}>.`,
        tone: 'burgundy',
        footer: 'Revisión completada'
    });
}

async function execute(interaction) {
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

    const [, action, rawId] = interaction.customId.split(':');
    const id = Number.parseInt(rawId, 10);
    if (!Number.isInteger(id)) return undefined;

    if (action === 'view') {
        await interaction.deferReply({ flags: ephemeral });
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

    if (action !== 'ok' && action !== 'no') return undefined;

    await interaction.deferUpdate();
    const decision = action === 'ok' ? 'approve' : 'reject';
    const res = await resolveSubmission(interaction.client, interaction.user.id, id, decision);

    if (!res.ok) {
        const msg = res.reason === 'missing'
            ? `No se encontró ninguna entrega con el ID **#${id}**.`
            : `La entrega **#${id}** ya ha sido procesada anteriormente.`;
        return interaction.followUp({
            embeds: [createCrownEmbed({ title: 'Expediente no disponible', description: msg, tone: 'smoke' })],
            flags: ephemeral
        });
    }

    const embed = buildResolutionEmbed(id, decision, res.submission, res.reward, interaction.user.id);
    return interaction.editReply({
        embeds: [embed],
        components: [],
        allowedMentions: { parse: [] }
    });
}

module.exports = {
    prefix: PREFIX,
    execute,
    buildSubmissionDetailPayload,
    resolveSubmission,
    buildResolutionEmbed
};
