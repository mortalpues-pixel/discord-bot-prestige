const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('Muestra los objetos de prestigio disponibles para comprar.'),
    async execute(interaction) {
        await interaction.deferReply();
        const items = await db.getVisibleShopItems();

        if (items.length === 0) {
            return interaction.editReply('La tienda está vacía por ahora.');
        }

        let description = 'Usa `/comprar <id>` para adquirir un objeto.\n\n';

        const multipliers = items.filter(i => i.type === 'multiplier');
        const medals = items.filter(i => i.type === 'medal');

        if (multipliers.length > 0) {
            description += '⚡ **Multiplicadores de Prestigio**\n';
            multipliers.forEach(m => {
                let stockText = (m.stock !== null && m.stock !== undefined) ? (m.stock > 0 ? ` | 📦 **Stock: ${m.stock}**` : ` | ❌ **Agotado**`) : '';
                description += `\`[ID: ${m.itemId}]\` **${m.name}**\n *Multiplica tus ganancias de prestigio por x${m.multiplier_value} durante sus próximos ${m.multiplier_uses} usos.* • Coste: 💳 **${m.price} pts**${stockText}\n\n`;
            });
        }

        if (medals.length > 0) {
            description += '🏅 **Medallas de Colección**\n';
            medals.forEach(m => {
                let stockText = (m.stock !== null && m.stock !== undefined) ? (m.stock > 0 ? ` | 📦 **Stock: ${m.stock}**` : ` | ❌ **Agotado**`) : '';
                description += `\`[ID: ${m.itemId}]\` ${m.emoji} **${m.name}**\n *Aparece permanentemente en tu tarjeta de perfil visual en /prestigio.* • Coste: 💳 **${m.price} pts**${stockText}\n\n`;
            });
        }

        const embed = createPremiumEmbed('🛒 Tienda de Prestigio', description);
        await interaction.editReply({ embeds: [embed] });
    }
};
