const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const config = require('../config.js');

try {
    registerFont(path.join(__dirname, '..', 'assets', 'Roboto-Regular.ttf'), { family: 'Roboto' });
    registerFont(path.join(__dirname, '..', 'assets', 'Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
    registerFont(path.join(__dirname, '..', 'assets', 'Roboto-Regular.ttf'), { family: 'Roboto' });
} catch (e) {
    console.warn('Alerta: No se pudieron cargar las fuentes personalizadas para Canvas.', e);
}

async function generateProfileCard(user, customRankName, userData) {
    const prestigeAmount = userData ? (userData.prestige || 0) : 0;
    const weeklyPrestige = userData ? (userData.weekly_prestige || 0) : 0;

    // Canvas dimensions
    const width = 800;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw elegant background (Black with subtlety)
    ctx.fillStyle = '#0a0a0a'; // Deep black-gray
    ctx.fillRect(0, 0, width, height);

    // Add a golden gradient accent line at the bottom
    const gradient = ctx.createLinearGradient(0, height - 10, width, height);
    gradient.addColorStop(0, '#B8860B'); // Dark goldenrod
    gradient.addColorStop(0.5, '#FFD700'); // Gold
    gradient.addColorStop(1, '#B8860B'); // Dark goldenrod
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - 10, width, 10);
    
    // Add a golden border around the entire card
    ctx.strokeStyle = '#DAA520'; // Goldenrod
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // 2. Load and draw the Family Logo as a watermark/decor
    try {
        const logoPath = path.join(__dirname, '..', config.branding.logoPath || 'assets/logo.png');
        const logo = await loadImage(logoPath);
        ctx.globalAlpha = 0.15; // Make it subtle
        // Draw on the right side
        const logoSize = 350;
        ctx.drawImage(logo, width - logoSize + 20, -20, logoSize, logoSize);
        ctx.globalAlpha = 1.0; // Reset alpha
    } catch (err) {
        console.warn('Could not load logo for watermark:', err.message);
    }

    // 3. Draw User Avatar (Circular)
    const avatarSize = 180;
    const avatarX = 50;
    const avatarY = (height - avatarSize) / 2;

    try {
        // user.displayAvatarURL returns a webp by default, request png/jpg
        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // Draw golden ring around avatar
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#FFD700'; // Gold
        ctx.stroke();
    } catch (err) {
        console.warn('Could not load user avatar:', err.message);
        // Fallback placeholder
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.fill();
    }

    // 4. Texts
    const textStartX = avatarX + avatarSize + 40;
    
    // Username (White)
    let nameFontSize = 44;
    const nameMaxWidth = 340;
    ctx.font = `bold ${nameFontSize}px Roboto`;
    
    // Dynamically reduce font size if name is too long (prevents the "squished" look)
    while (ctx.measureText(user.username.toUpperCase()).width > nameMaxWidth && nameFontSize > 28) {
        nameFontSize -= 2;
        ctx.font = `bold ${nameFontSize}px Roboto`;
    }
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(user.username.toUpperCase(), textStartX, avatarY + 45, nameMaxWidth);

    // Title / Rank (Gold)
    // Convert "copy-paste" Unicode fonts to standard readable letters using NFKC normalization
    let normalizedRank = (customRankName || 'Ciudadano').normalize('NFKC');
    let cleanRankName = normalizedRank.replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑüÜ¡!¿?]/g, '');
    cleanRankName = cleanRankName.replace(/{}\s*|\[\]\s*|\(\)\s*/g, '').trim();
    
    let rankFontSize = 26;
    const rankMaxWidth = 340;
    ctx.font = `${rankFontSize}px Roboto`;
    
    // Also scale rank font size if needed
    while (ctx.measureText(cleanRankName || 'Ciudadano').width > rankMaxWidth && rankFontSize > 18) {
        rankFontSize -= 1;
        ctx.font = `${rankFontSize}px Roboto`;
    }
    
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.fillText(cleanRankName || 'Ciudadano', textStartX, avatarY + 95, rankMaxWidth);

    // Total Prestige
    ctx.font = 'bold 36px Roboto';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Prestigio:', textStartX, avatarY + 155);
    
    ctx.font = 'bold 36px Roboto';
    ctx.fillStyle = '#DAA520'; // Distinct gold
    // Calculate width of "Prestigio: " to place the number right after it
    const labelWidth = ctx.measureText('Prestigio: ').width;
    const valWidth = ctx.measureText(prestigeAmount.toString()).width; // Medido con 36px
    ctx.fillText(prestigeAmount.toString(), textStartX + labelWidth, avatarY + 155);

    if (userData && userData.multiplier_uses && userData.multiplier_uses > 0) {
        ctx.font = 'bold 24px Roboto';
        ctx.fillStyle = '#FFA500'; 
        ctx.fillText(`⚡ x${userData.multiplier_value} (${userData.multiplier_uses} usos)`, textStartX + labelWidth + valWidth + 20, avatarY + 153);
    }

    // Weekly Prestige (smaller)
    ctx.font = '22px Roboto';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`Ganancia Semanal: +${weeklyPrestige}`, textStartX, avatarY + 195);

    // Vertical Medals with Names
    if (userData && userData.medalDetails && userData.medalDetails.length > 0) {
        let medalY = 105; // Starting Y position (aligns with Username baseline)
        
        userData.medalDetails.slice(0, 4).forEach((medal) => {
            // Draw Name
            ctx.font = 'bold 18px Roboto';
            ctx.fillStyle = medal.color || '#CCCCCC';
            let mName = medal.name;
            if (mName.length > 20) mName = mName.substring(0, 18) + '...';
            mName = mName.toUpperCase();
            
            ctx.textAlign = 'right';
            ctx.fillText(mName, width - 30, medalY - 2);
            
            let nameWidth = ctx.measureText(mName).width;
            
            // Draw Emoji
            ctx.font = '24px "Segoe UI Emoji", "Apple Color Emoji", Roboto';
            ctx.fillText(medal.emoji, width - 30 - nameWidth - 10, medalY);
            
            medalY += 35; // Row spacing
        });
        ctx.textAlign = 'left'; // Reset
    }

    return canvas.toBuffer('image/png');
}

async function generateLeaderboardCard(topUsers) {
    const width = 800;
    const itemHeight = 100;
    const headerHeight = 140;
    const paddingBottom = 30;
    const height = headerHeight + (Math.max(topUsers.length, 1) * itemHeight) + paddingBottom;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Accent line
    const gradient = ctx.createLinearGradient(0, height - 10, width, height);
    gradient.addColorStop(0, '#B8860B');
    gradient.addColorStop(0.5, '#FFD700');
    gradient.addColorStop(1, '#B8860B');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - 10, width, 10);
    
    // Border
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Header
    const crownIcon = '♔';
    ctx.font = '50px Roboto';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText(`${crownIcon} RANKING SEMANAL ${crownIcon}`, width / 2, 70);
    
    ctx.font = '22px Roboto';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('Los miembros más prestigiosos de esta semana', width / 2, 110);
    ctx.textAlign = 'left';

    // Draw Users
    if (topUsers.length === 0) {
        ctx.font = 'italic 30px Roboto';
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'center';
        ctx.fillText('Nadie ha ganado prestigio esta semana todavía.', width / 2, height / 2 + 20);
        return canvas.toBuffer('image/png');
    }

    let yOffset = headerHeight + 10;
    for (let i = 0; i < topUsers.length; i++) {
        const { user, prestige } = topUsers[i];
        
        let rankColor = '#AAAAAA'; // default grey for 4th and 5th
        if (i === 0) rankColor = '#FFD700'; // Gold
        else if (i === 1) rankColor = '#E6E8FA'; // Silver
        else if (i === 2) rankColor = '#CD7F32'; // Bronze

        // Rank Number
        ctx.font = 'bold 42px Roboto';
        ctx.fillStyle = rankColor;
        ctx.fillText(`#${i + 1}`, 30, yOffset + 65);

        // Avatar
        const avatarSize = 70;
        const avatarX = 110;
        const avatarY = yOffset + 15;

        try {
            const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 128 });
            const avatar = await loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
            
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.lineWidth = 3;
            ctx.strokeStyle = rankColor;
            ctx.stroke();
        } catch (e) {
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.fill();
        }

        // Username
        let normalizedName = user.username ? user.username.normalize('NFKC') : '';
        let cleanName = normalizedName.replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑüÜ¡!¿?]/g, '').trim();
        if (!cleanName) cleanName = 'Usuario';
        
        ctx.font = 'bold 30px Roboto';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(cleanName.toUpperCase(), 210, yOffset + 50);

        // Prestige Score
        ctx.font = 'bold 36px Roboto';
        ctx.fillStyle = '#DAA520'; // Distinct gold
        ctx.textAlign = 'right';
        ctx.fillText(`+${prestige} pts`, width - 30, yOffset + 60);
        ctx.textAlign = 'left';

        // Draw a light separator line if not the last item
        if (i !== topUsers.length - 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(30, yOffset + itemHeight);
            ctx.lineTo(width - 30, yOffset + itemHeight);
            ctx.stroke();
        }

        yOffset += itemHeight;
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    generateProfileCard,
    generateLeaderboardCard
};
