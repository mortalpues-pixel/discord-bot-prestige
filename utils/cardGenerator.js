const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const config = require('../config.js');

async function generateProfileCard(user, prestigeAmount, weeklyPrestige, customRankName) {
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
    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(user.username.toUpperCase(), textStartX, avatarY + 45);

    // Title / Rank (Gold)
    const cleanRankName = (customRankName || 'Ciudadano').replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    ctx.font = 'italic 28px serif';
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.fillText(`Role: ${cleanRankName}`, textStartX, avatarY + 95);

    // Total Prestige
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Prestigio:', textStartX, avatarY + 155);
    
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#DAA520'; // Distinct gold
    // Calculate width of "Prestigio: " to place the number right after it
    const labelWidth = ctx.measureText('Prestigio: ').width;
    ctx.fillText(prestigeAmount.toString(), textStartX + labelWidth, avatarY + 155);

    // Weekly Prestige (smaller)
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`Ganancia Semanal: +${weeklyPrestige}`, textStartX, avatarY + 195);

    return canvas.toBuffer('image/png');
}

module.exports = {
    generateProfileCard
};
