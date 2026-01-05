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
    }
};
