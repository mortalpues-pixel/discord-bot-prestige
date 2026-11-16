const { renderProfileCard } = require('./conclaveArt');

async function generateProfileCard(user, customRankName, userData) {
    const displayName = user?.displayName || user?.globalName || user?.username || 'Miembro';
    const avatarUrl = typeof user?.displayAvatarURL === 'function'
        ? user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true })
        : null;

    return renderProfileCard({
        displayName,
        rankName: customRankName || 'Ciudadano',
        avatarUrl,
        prestige: userData?.prestige || 0,
        weeklyPrestige: userData?.weekly_prestige || 0
    });
}

module.exports = { generateProfileCard };
