const crypto = require('node:crypto');
const Conclave = require('../models/Conclave');
const config = require('../config');
const view = require('../utils/conclaveView');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const neededFor = seats => Math.ceil(seats / 2); // 8 votantes -> 4 negras rechazan; 7 -> 4; 5 -> 3

/** Fisher-Yates con aleatoriedad criptográfica. */
function shuffle(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────

/** Construye los índices (incluido el único parcial por aspirante). Llamar tras conectar. */
async function ensureIndexes() {
    await Conclave.init();
}

async function openConclave({ guildId, channelId, candidate, openedBy, seats }) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const voteId = crypto.randomBytes(3).toString('hex');
        try {
            const doc = await Conclave.create({
                voteId, guildId, channelId,
                candidateId: candidate.id,
                candidateName: candidate.name,
                candidateAvatar: candidate.avatar ?? null,
                openedBy, seats,
                needed: neededFor(seats)
            });
            return { ok: true, doc };
        } catch (err) {
            if (err && err.code === 11000) {
                if (err.keyPattern && err.keyPattern.voteId) continue; // colisión de id: reintentar
                return { ok: false, reason: 'duplicate' };
            }
            throw err;
        }
    }
    throw new Error('No se pudo generar un identificador de cónclave único.');
}

async function attachMessage(voteId, messageId, hasBanner) {
    return Conclave.updateOne({ voteId }, { $set: { messageId, hasBanner: Boolean(hasBanner) } });
}

/** Elimina un cónclave que no llegó a publicarse (p. ej. el bot no pudo enviar el panel). */
async function discard(voteId) {
    return Conclave.deleteOne({ voteId, messageId: null, status: 'open' });
}

const getConclave = voteId => Conclave.findOne({ voteId });

// ── Votación ─────────────────────────────────────────────────────────────────

function voterToken(voteId, userId) {
    return crypto
        .createHmac('sha256', `${voteId}:${process.env.CONCLAVE_SALT || 'helmreich-conclave'}`)
        .update(String(userId))
        .digest('hex')
        .slice(0, 24);
}

function hasVoted(doc, userId) {
    if (!doc || !Array.isArray(doc.voters)) return false;
    const token = voterToken(doc.voteId, userId);
    const raw = String(userId);
    return doc.voters.includes(token) || doc.voters.includes(raw);
}

/**
 * Deposita una bola de forma ATÓMICA: una sola operación comprueba que la urna está abierta,
 * que hay sitio y que la persona no ha votado, y a la vez apunta un token HMAC en `voters` y
 * suma 1 al contador de su color. No existe ningún dato que vincule persona y color.
 *
 * @returns {{ok:true, doc, sealed:boolean} | {ok:false, reason:'missing'|'closed'|'already'|'full'}}
 */
async function castVote({ voteId, userId, choice }) {
    if (choice !== 'black' && choice !== 'white') throw new Error(`Bola inválida: ${choice}`);

    const token = voterToken(voteId, userId);
    const doc = await Conclave.findOneAndUpdate(
        {
            voteId,
            status: 'open',
            voters: { $nin: [token, String(userId)] },
            $expr: { $lt: [{ $size: { $ifNull: ['$voters', []] } }, '$seats'] }
        },
        { $addToSet: { voters: token }, $inc: { [`tally.${choice}`]: 1 } },
        { new: true }
    );

    if (!doc) {
        const current = await Conclave.findOne({ voteId }).select('voteId status voters seats tally');
        if (!current) return { ok: false, reason: 'missing' };
        if (current.status !== 'open') return { ok: false, reason: 'closed' };
        if (hasVoted(current, userId)) return { ok: false, reason: 'already' };
        if ((current.voters?.length || 0) >= current.seats) {
            await sealConclave(current);
        }
        return { ok: false, reason: 'full' };
    }

    if (doc.voters.length >= doc.seats) {
        const sealed = await sealConclave(doc);
        return { ok: true, doc: sealed || doc, sealed: Boolean(sealed) };
    }
    return { ok: true, doc, sealed: false };
}

/** Sella la urna: baraja las bolas, olvida quién votó y pasa a escrutinio. Idempotente. */
async function sealConclave(doc) {
    const balls = [
        ...Array(doc.tally.black).fill('black'),
        ...Array(doc.tally.white).fill('white')
    ];
    return Conclave.findOneAndUpdate(
        { voteId: doc.voteId, status: 'open' },
        {
            $set: { status: 'revealing', sequence: shuffle(balls), revealed: 0, closedAt: new Date() },
            $unset: { voters: 1 }
        },
        { new: true }
    );
}

/** Anula un cónclave abierto (si aún no está lleno). Devuelve null si ya no estaba abierto. */
async function annulConclave({ voteId, byUserId }) {
    return Conclave.findOneAndUpdate(
        {
            voteId,
            status: 'open',
            $expr: { $lt: [{ $size: { $ifNull: ['$voters', []] } }, '$seats'] }
        },
        {
            $set: { status: 'cancelled', annulledBy: byUserId, closedAt: new Date() },
            $unset: { voters: 1 }
        },
        { new: true }
    );
}

// ── Mensajes en el canal ─────────────────────────────────────────────────────

async function fetchChannel(client, channelId) {
    const channel = client.channels.cache.get(channelId) ?? await client.channels.fetch(channelId);
    if (!channel || typeof channel.send !== 'function') throw new Error(`Canal ${channelId} no disponible`);
    return channel;
}

/** Reintenta envíos transitorios (429/5xx/red) con espera creciente. */
async function withRetry(label, fn, attempts = 4) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            console.warn(`[conclave] ${label} falló (intento ${i + 1}/${attempts}): ${err.message}`);
            await sleep(1000 * 2 ** i);
        }
    }
    throw lastError;
}

async function refreshPanelNow(client, voteId) {
    const doc = await Conclave.findOne({ voteId });
    if (!doc || !doc.messageId) return;
    try {
        const channel = await fetchChannel(client, doc.channelId);
        await channel.messages.edit(doc.messageId, view.panelPayload(doc));
    } catch (err) {
        console.warn(`[conclave] No se pudo actualizar el panel de ${voteId}: ${err.message}`);
    }
}

// Las ediciones del contador se agrupan: 8 votos casi simultáneos = 1 edición, no 8.
const pendingRefresh = new Map();
function scheduleRefresh(client, voteId) {
    if (pendingRefresh.has(voteId)) return;
    const timer = setTimeout(() => {
        pendingRefresh.delete(voteId);
        refreshPanelNow(client, voteId);
    }, config.conclave.panelRefreshDebounceMs);
    pendingRefresh.set(voteId, timer);
}

async function refreshPanel(client, voteId) {
    const timer = pendingRefresh.get(voteId);
    if (timer) {
        clearTimeout(timer);
        pendingRefresh.delete(voteId);
    }
    await refreshPanelNow(client, voteId);
}

function cancelPendingRefreshes() {
    for (const timer of pendingRefresh.values()) clearTimeout(timer);
    pendingRefresh.clear();
}

// ── Escrutinio ───────────────────────────────────────────────────────────────

const running = new Set();

/**
 * Canta las bolas una a una (cada `intervalMs`) y proclama el veredicto.
 * El progreso vive en MongoDB (`revealed`), así que si el bot se reinicia a mitad
 * se reanuda con `recoverConclaves`. Un mismo cónclave no puede escrutarse dos veces a la vez.
 */
async function runReveal(client, voteId, { intervalMs = config.conclave.revealIntervalMs } = {}) {
    if (running.has(voteId)) return;
    running.add(voteId);

    try {
        let doc = await Conclave.findOne({ voteId, status: 'revealing' });
        if (!doc) return;

        const channel = await fetchChannel(client, doc.channelId);

        // Aviso de apertura de urna (se marca tras enviar con éxito para no perderlo si falla)
        if (!doc.introSent) {
            await withRetry('intro', () => channel.send(view.introPayload(doc)));
            await Conclave.updateOne({ voteId, status: 'revealing' }, { $set: { introSent: true } });
            await sleep(intervalMs);
        }

        for (;;) {
            doc = await Conclave.findOne({ voteId, status: 'revealing' });
            if (!doc || doc.revealed >= doc.sequence.length) break;

            const index = doc.revealed;
            const payload = await view.ballPayload(doc, doc.sequence[index], index + 1);
            await withRetry(`bola ${index + 1}`, () => channel.send(payload));
            await Conclave.updateOne(
                { voteId, status: 'revealing', revealed: index },
                { $set: { revealed: index + 1 } }
            );
            await sleep(intervalMs);
        }

        await finalize(client, voteId, channel);
    } catch (err) {
        // El estado queda en 'revealing': se reanudará en el próximo arranque.
        console.error(`[conclave] Escrutinio ${voteId} interrumpido:`, err);
    } finally {
        running.delete(voteId);
    }
}

async function finalize(client, voteId, channel) {
    const doc = await Conclave.findOne({ voteId, status: 'revealing' });
    if (!doc) return;

    const black = doc.sequence.filter(b => b === 'black').length;
    const white = doc.sequence.length - black;

    const closed = await Conclave.findOneAndUpdate(
        { voteId, status: 'revealing' },
        {
            $set: {
                status: 'closed',
                verdict: black >= doc.needed ? 'no_apto' : 'apto',
                finalBlack: black,
                finalWhite: white,
                closedAt: new Date()
            }
        },
        { new: true }
    );
    if (!closed) return;

    const payload = await view.verdictPayload(closed);
    await withRetry('veredicto', () => channel.send(payload));
    await refreshPanel(client, voteId);
}

/** Al arrancar: sella urnas llenas que quedaron abiertas y reanuda escrutinios a medias. */
async function recoverConclaves(client) {
    const fullOpen = await Conclave.find({
        status: 'open',
        $expr: { $gte: [{ $size: { $ifNull: ['$voters', []] } }, '$seats'] }
    });
    for (const c of fullOpen) {
        const sealed = await sealConclave(c);
        if (sealed) await refreshPanel(client, c.voteId);
    }

    const pending = await Conclave.find({ status: 'revealing' }).select('voteId');
    for (const { voteId } of pending) {
        console.log(`[conclave] Reanudando escrutinio ${voteId}`);
        runReveal(client, voteId); // sin await: corren en paralelo
    }
    return pending.length;
}

module.exports = {
    neededFor, shuffle, voterToken, hasVoted,
    ensureIndexes, openConclave, attachMessage, discard, getConclave,
    castVote, sealConclave, annulConclave,
    refreshPanel, scheduleRefresh, cancelPendingRefreshes,
    runReveal, recoverConclaves
};
