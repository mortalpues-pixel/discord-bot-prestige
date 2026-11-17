/**
 * Identidad visual de la Corte Helmreich para los mensajes del bot.
 * Paleta sobria: obsidiana, carbón, oro viejo, marfil, burdeos y humo.
 * Sin emojis decorativos: el peso lo llevan la tipografía y el color.
 */
module.exports = {
    colors: {
        obsidian: 0x0D0C0E,
        charcoal: 0x17151A,
        gold: 0xB89B5E,
        ivory: 0xE9E2D0,
        burgundy: 0x5E1A28,
        smoke: 0x8A8580
    },

    // Papeletas: rombo lleno = depositada, rombo vacío = pendiente.
    // Idénticos para blanca y negra, para no revelar nada del voto.
    glyph: {
        deposited: '\u25C6',
        pending: '\u25C7'
    },

    house: 'Casa Helmreich',
    crestUrl: 'https://cdn.discordapp.com/avatars/1451007290923814953/028341bf0e88e6f1562e7e280a26b581.png?size=256'
};
