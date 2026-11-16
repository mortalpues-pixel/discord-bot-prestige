const { MessageFlags } = require('discord.js');
const config = require('../config');
const { isHighCommand, hasRole } = require('../utils/permissions');
const conclave = require('../services/conclave');
const view = require('../utils/conclaveView');

const ephemeral = MessageFlags.Ephemeral;

const DENIALS = {
    missing: 'Este cónclave ya no existe.',
    closed: 'La urna ya no admite papeletas.',
    already: 'Ya has depositado tu bola en esta urna.',
    full: 'La urna ya está completa.'
};

/** ¿Tiene el miembro el sello de la Corte (rol votante)? */
function canVote(interaction) {
    return hasRole(interaction.member, config.conclave.voterRoleId);
}

// Primer clic: no vota, abre una confirmación PRIVADA (el voto es irrevocable).
async function pick(interaction, voteId, choice) {
    await interaction.deferReply({ flags: ephemeral });

    const doc = await conclave.getConclave(voteId);
    if (!doc || doc.status !== 'open') return interaction.editReply(view.plain(DENIALS.closed));
    if (!canVote(interaction)) {
        return interaction.editReply(view.plain('Solo los miembros con el sello de la Corte pueden depositar bola.'));
    }
    if (interaction.user.id === doc.candidateId) {
        return interaction.editReply(view.plain('El aspirante no puede votar en su propia admisión.'));
    }
    if (conclave.hasVoted(doc, interaction.user.id)) return interaction.editReply(view.plain(DENIALS.already));

    return interaction.editReply(view.confirmPayload(doc, choice));
}

// Confirmación: aquí cae la bola en la urna.
async function deposit(interaction, voteId, choice) {
    await interaction.deferUpdate();

    const doc = await conclave.getConclave(voteId);
    if (!doc) return interaction.editReply(view.plain(DENIALS.missing));
    if (!canVote(interaction)) {
        return interaction.editReply(view.plain('Solo los miembros con el sello de la Corte pueden depositar bola.'));
    }
    if (interaction.user.id === doc.candidateId) {
        return interaction.editReply(view.plain('El aspirante no puede votar en su propia admisión.'));
    }

    const result = await conclave.castVote({ voteId, userId: interaction.user.id, choice });
    if (!result.ok) return interaction.editReply(view.plain(DENIALS[result.reason] ?? DENIALS.closed));

    try {
        await interaction.editReply(view.plain(
            `Tu **${view.choiceLabel(choice)}** ha caído en la urna. Tu voto es secreto.`
        ));
    } catch (err) {
        console.warn('[conclave] No se pudo confirmar el voto en efímero:', err.message);
    }

    if (result.sealed) {
        await conclave.refreshPanel(interaction.client, voteId);
        conclave.runReveal(interaction.client, voteId); // en segundo plano
    } else {
        conclave.scheduleRefresh(interaction.client, voteId);
    }
}

async function withdraw(interaction) {
    await interaction.deferUpdate();
    return interaction.editReply(view.plain('Has retirado la mano. La urna sigue abierta para ti.'));
}

// Anular (paso 1): abre confirmación privada para evitar borrados accidentales por un clic.
async function annulPrompt(interaction, voteId) {
    await interaction.deferReply({ flags: ephemeral });

    const doc = await conclave.getConclave(voteId);
    if (!doc || doc.status !== 'open') {
        return interaction.editReply(view.plain('Este cónclave ya no se puede anular.'));
    }
    if (!isHighCommand(interaction.member) && interaction.user.id !== doc.openedBy) {
        return interaction.editReply(view.plain('Solo quien convocó el cónclave o el Alto Mando pueden anularlo.'));
    }

    return interaction.editReply(view.annulConfirmPayload(doc));
}

// Anular (paso 2): ejecuta la anulación confirmada y actualiza el panel público.
async function annulConfirm(interaction, voteId) {
    await interaction.deferUpdate();

    const doc = await conclave.getConclave(voteId);
    if (!doc || doc.status !== 'open') {
        return interaction.editReply(view.plain('Este cónclave ya no se puede anular.'));
    }
    if (!isHighCommand(interaction.member) && interaction.user.id !== doc.openedBy) {
        return interaction.editReply(view.plain('Solo quien convocó el cónclave o el Alto Mando pueden anularlo.'));
    }

    const annulled = await conclave.annulConclave({ voteId, byUserId: interaction.user.id });
    if (!annulled) {
        return interaction.editReply(view.plain('Este cónclave ya no se puede anular.'));
    }

    try {
        await interaction.editReply(view.plain('Has anulado el cónclave.'));
    } catch (err) {
        console.warn('[conclave] No se pudo confirmar la anulación en efímero:', err.message);
    }

    await conclave.refreshPanel(interaction.client, voteId);
}

module.exports = {
    prefix: view.PREFIX,

    async execute(interaction) {
        const [, action, voteId, code] = interaction.customId.split(':');
        const choice = view.choiceFromCode(code);

        switch (action) {
            case 'p': return choice && pick(interaction, voteId, choice);
            case 'd': return choice && deposit(interaction, voteId, choice);
            case 'n': return withdraw(interaction);
            case 'a': return annulPrompt(interaction, voteId);
            case 'ac': return annulConfirm(interaction, voteId);
            default: return undefined;
        }
    }
};
