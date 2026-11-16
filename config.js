module.exports = {
    // List of possible missions
    missions: [
        {
            key: 'msg_100',
            description: 'Envía 100 mensajes hoy en cualquier canal.',
            reward: 50
        },
        {
            key: 'vc_1hr',
            description: 'Pasa 1 hora en un canal de voz.',
            reward: 75
        },
        {
            key: 'invite_1',
            description: 'Invita a 1 amigo al servidor.',
            reward: 100
        },
        {
            key: 'react_50',
            description: 'Reacciona a 50 mensajes distintos.',
            reward: 30
        },
        {
            key: 'bump',
            description: 'Ayuda a promocionar el servidor (Bump) si hay bot de bump.',
            reward: 40
        }
    ],
    branding: {
        color: 0xFFFFFF, // White
        logoPath: './assets/logo.png'
    },

    // Carpetas de /commands que NO se cargan ni se registran en Discord.
    // 'economy' = /tienda, /comprar, /admintienda (desactivada a petición del dueño;
    // para reactivarla basta con quitarla de esta lista y reiniciar).
    disabledModules: ['economy'],

    // Cónclave de admisión ("la bola negra")
    conclave: {
        // Rol que puede depositar bola. Se puede sobrescribir con CONCLAVE_VOTER_ROLE_ID.
        voterRoleId: process.env.CONCLAVE_VOTER_ROLE_ID || '1571968291105276044',
        // Límites de /votacion. Con menos de 3 votantes el anonimato se deduce por aritmética.
        minSeats: 3,
        maxSeats: 30,
        // Pausa entre bola y bola durante el escrutinio.
        revealIntervalMs: 5000,
        // Agrupa las ediciones del panel (contador de papeletas) para no chocar con rate limits.
        panelRefreshDebounceMs: 1500
    }
};
