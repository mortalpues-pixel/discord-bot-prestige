const mongoose = require('mongoose');

/**
 * Cónclave de admisión ("la bola negra").
 *
 * ANONIMATO: este documento NUNCA relaciona a un votante con su bola.
 *  - `voters` solo guarda QUIÉN ha depositado (para impedir el doble voto) y se borra al sellar la urna.
 *  - `tally` son dos contadores sueltos; no hay timestamps, ni orden, ni nada por papeleta.
 *  - `sequence` es el orden de escrutinio, barajado con crypto.randomInt al sellar la urna.
 */
const conclaveSchema = new mongoose.Schema({
    voteId: { type: String, required: true, unique: true },

    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    hasBanner: { type: Boolean, default: false },

    candidateId: { type: String, required: true },
    candidateName: { type: String, required: true },
    candidateAvatar: { type: String, default: null },
    openedBy: { type: String, required: true },
    annulledBy: { type: String, default: null },

    seats: { type: Number, required: true, min: 1 },
    needed: { type: Number, required: true, min: 1 }, // bolas negras que rechazan al aspirante

    status: { type: String, enum: ['open', 'revealing', 'closed', 'cancelled'], default: 'open' },

    voters: { type: [String], default: [] },
    tally: {
        white: { type: Number, default: 0 },
        black: { type: Number, default: 0 }
    },

    sequence: { type: [String], default: [] }, // 'black' | 'white', ya barajado
    revealed: { type: Number, default: 0 },
    introSent: { type: Boolean, default: false },

    verdict: { type: String, default: null }, // 'apto' | 'no_apto'
    finalWhite: { type: Number, default: null },
    finalBlack: { type: Number, default: null },

    createdAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null }
});

// Un aspirante no puede tener dos cónclaves vivos a la vez (blindado a nivel de base de datos).
conclaveSchema.index(
    { guildId: 1, candidateId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['open', 'revealing'] } } }
);
conclaveSchema.index({ status: 1 });

module.exports = mongoose.model('Conclave', conclaveSchema);
