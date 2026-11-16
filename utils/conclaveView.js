const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder
} = require('discord.js');
const crown = require('./crown');

// ── customIds ────────────────────────────────────────────────────────────────
// cx:p:<id>:b|w  elegir bola (abre la confirmación privada)
// cx:d:<id>:b|w  depositar (confirmado)
// cx:n:<id>      retirar la mano
// cx:a:<id>      anular el cónclave (abre confirmación privada)
// cx:ac:<id>     confirmar anulación
const PREFIX = 'cx';
const ids = {
    pick: (voteId, choice) => `${PREFIX}:p:${voteId}:${choice === 'black' ? 'b' : 'w'}`,
    deposit: (voteId, choice) => `${PREFIX}:d:${voteId}:${choice === 'black' ? 'b' : 'w'}`,
    withdraw: voteId => `${PREFIX}:n:${voteId}`,
    annul: voteId => `${PREFIX}:a:${voteId}`,
    annulConfirm: voteId => `${PREFIX}:ac:${voteId}`
};
const choiceFromCode = code => (code === 'b' ? 'black' : code === 'w' ? 'white' : null);
const choiceLabel = choice => (choice === 'black' ? 'bola negra' : 'bola blanca');

// ── Arte (canvas) con degradación elegante ───────────────────────────────────
let artModule;
function art() {
    if (artModule === undefined) {
        try {
            artModule = require('./conclaveArt');
        } catch (err) {
            console.warn('[conclave] Arte no disponible, se usarán embeds sin imagen:', err.message);
            artModule = null;
        }
    }
    return artModule;
}

async function render(fnName, ...args) {
    const mod = art();
    if (!mod || typeof mod[fnName] !== 'function') return null;
    try {
        return await mod[fnName](...args);
    } catch (err) {
        console.warn(`[conclave] Fallo al renderizar ${fnName}:`, err.message);
        return null;
    }
}

const footer = doc => ({ text: `Cónclave ${doc.voteId} · ${crown.house}` });

function urnLine(doc) {
    const n = doc.voters ? doc.voters.length : 0;
    const full = Math.min(n, doc.seats);
    return `${crown.glyph.deposited.repeat(full)}${crown.glyph.pending.repeat(doc.seats - full)}`;
}

// ── Panel público ────────────────────────────────────────────────────────────
function controls(doc) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(ids.pick(doc.voteId, 'white'))
            .setLabel('Bola blanca')
            .setEmoji('\u26AA')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(ids.pick(doc.voteId, 'black'))
            .setLabel('Bola negra')
            .setEmoji('\u26AB')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(ids.annul(doc.voteId))
            .setLabel('Anular')
            .setStyle(ButtonStyle.Secondary)
    );
}

function panelPayload(doc) {
    const embed = new EmbedBuilder().setFooter(footer(doc));
    if (doc.hasBanner) embed.setImage('attachment://convocatoria.png');

    let components = [];

    switch (doc.status) {
        case 'open': {
            const deposited = doc.voters.length;
            embed
                .setColor(crown.colors.gold)
                .setDescription([
                    `La Corte somete a votación la admisión de <@${doc.candidateId}> en la Familia Helmreich.`,
                    '',
                    'Cada miembro con derecho a voto deposita **una sola bola**: blanca, a favor; negra, en contra. La urna es secreta y la decisión no admite retractación.',
                    '',
                    `**Urna** \u2003 ${urnLine(doc)} \u2003 ${deposited} de ${doc.seats}`,
                    '',
                    `Con **${doc.needed}** bolas negras, el aspirante queda rechazado.`
                ].join('\n'));
            components = [controls(doc)];
            break;
        }
        case 'revealing':
            embed
                .setColor(crown.colors.charcoal)
                .setDescription([
                    `Han depositado su bola los ${doc.seats} convocados al cónclave de <@${doc.candidateId}>.`,
                    '',
                    '**La urna queda sellada.** Se procede al escrutinio.'
                ].join('\n'));
            break;
        case 'closed': {
            const apto = doc.verdict === 'apto';
            embed
                .setColor(apto ? crown.colors.gold : crown.colors.burgundy)
                .setDescription([
                    `Concluye el cónclave de <@${doc.candidateId}>.`,
                    '',
                    apto
                        ? '**Veredicto: apto.** La Corte admite al aspirante en la Familia Helmreich.'
                        : '**Veredicto: no apto.** La Corte no admite al aspirante en la Familia Helmreich.'
                ].join('\n'));
            break;
        }
        case 'cancelled':
        default:
            embed
                .setColor(crown.colors.smoke)
                .setDescription([
                    `El cónclave de <@${doc.candidateId}> ha sido **anulado**${doc.annulledBy ? ` por <@${doc.annulledBy}>` : ''}.`,
                    '',
                    'Las papeletas depositadas quedan sin efecto y no se computará ninguna.'
                ].join('\n'));
            break;
    }

    return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

async function openingPayload(doc) {
    const banner = await render('renderSummons', {
        candidateName: doc.candidateName,
        avatarUrl: doc.candidateAvatar,
        seats: doc.seats
    });

    const plainDoc = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const view = { ...plainDoc, hasBanner: Boolean(banner) };
    const payload = panelPayload(view);
    if (banner) payload.files = [new AttachmentBuilder(banner, { name: 'convocatoria.png' })];
    return { payload, hasBanner: Boolean(banner) };
}

// ── Escrutinio ───────────────────────────────────────────────────────────────
function introPayload(doc) {
    const seconds = Math.round(require('../config').conclave.revealIntervalMs / 1000);
    const embed = new EmbedBuilder()
        .setColor(crown.colors.gold)
        .setTitle('Escrutinio')
        .setDescription([
            `Se abre la urna del cónclave de <@${doc.candidateId}>.`,
            '',
            `Se cantarán ${doc.sequence.length} bolas, una cada ${seconds} segundos.`
        ].join('\n'))
        .setFooter(footer(doc));
    return { embeds: [embed], allowedMentions: { parse: [] } };
}

async function ballPayload(doc, kind, n) {
    const black = kind === 'black';
    const name = black ? 'bola-negra.png' : 'bola-blanca.png';
    const image = await render('renderBall', kind);

    const embed = new EmbedBuilder()
        .setColor(black ? crown.colors.charcoal : crown.colors.ivory)
        .setTitle(black ? '\u00A1Bola negra!' : '\u00A1Bola blanca!')
        .setDescription(`Papeleta ${n} de ${doc.sequence.length}`)
        .setFooter(footer(doc));

    const payload = { embeds: [embed], allowedMentions: { parse: [] } };
    if (image) {
        embed.setThumbnail(`attachment://${name}`);
        payload.files = [new AttachmentBuilder(image, { name })];
    }
    return payload;
}

function formatDate(date) {
    return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid'
    }).format(date);
}

async function verdictPayload(doc) {
    const apto = doc.verdict === 'apto';
    const acta = await render('renderVerdict', {
        candidateName: doc.candidateName,
        avatarUrl: doc.candidateAvatar,
        white: doc.finalWhite,
        black: doc.finalBlack,
        seats: doc.seats,
        needed: doc.needed,
        apto,
        dateText: formatDate(doc.closedAt || new Date())
    });

    const embed = new EmbedBuilder()
        .setColor(apto ? crown.colors.gold : crown.colors.burgundy)
        .setTitle(apto ? 'Apto' : 'No apto')
        .setDescription([
            apto
                ? `La Corte admite a <@${doc.candidateId}> en la Familia Helmreich.`
                : `La Corte no admite a <@${doc.candidateId}> en la Familia Helmreich.`,
            '',
            `Bolas blancas: **${doc.finalWhite}** \u00B7 Bolas negras: **${doc.finalBlack}**`,
            `Se requerían ${doc.needed} bolas negras para el rechazo.`
        ].join('\n'))
        .setFooter(footer(doc));

    const payload = {
        content: `<@${doc.candidateId}>`,
        embeds: [embed],
        allowedMentions: { users: [doc.candidateId] }
    };
    if (acta) {
        embed.setImage('attachment://acta.png');
        payload.files = [new AttachmentBuilder(acta, { name: 'acta.png' })];
    }
    return payload;
}

// ── Confirmación privada del votante / anulación ─────────────────────────────
function confirmPayload(doc, choice) {
    return {
        content: [
            `Vas a depositar una **${choiceLabel(choice)}** en el cónclave de **${doc.candidateName}**.`,
            'La decisión es definitiva y nadie sabrá cuál fue tu bola.'
        ].join('\n'),
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(ids.deposit(doc.voteId, choice))
                    .setLabel(`Depositar ${choiceLabel(choice)}`)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(ids.withdraw(doc.voteId))
                    .setLabel('Retirar la mano')
                    .setStyle(ButtonStyle.Secondary)
            )
        ]
    };
}

function annulConfirmPayload(doc) {
    return {
        content: [
            `Vas a **anular** el cónclave de **${doc.candidateName}** (${doc.voteId}).`,
            'Todas las papeletas depositadas se perderán y la votación quedará cerrada sin veredicto.'
        ].join('\n'),
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(ids.annulConfirm(doc.voteId))
                    .setLabel('Confirmar anulación')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(ids.withdraw(doc.voteId))
                    .setLabel('Retirar la mano')
                    .setStyle(ButtonStyle.Secondary)
            )
        ]
    };
}

const plain = content => ({ content, embeds: [], components: [], files: [] });

module.exports = {
    PREFIX, ids, choiceFromCode, choiceLabel,
    panelPayload, openingPayload, introPayload, ballPayload, verdictPayload,
    confirmPayload, annulConfirmPayload, plain, urnLine
};
