const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comprar')
        .setDescription('Compra un objeto de la tienda de prestigio usando su ID.')
        .addStringOption(opt => opt.setName('id').setDescription('La ID del objeto que deseas comprar (búscala en /tienda)').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const itemId = interaction.options.getString('id');

        const result = await db.buyShopItem(interaction.user.id, itemId);

        if (!result.success) {
            const embed = createPremiumEmbed('❌ Compra Fallida', result.reason);
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = createPremiumEmbed('✅ Compra Exitosa', `Has comprado el objeto **${result.item.name}** por **${result.item.price} pts**.\n\nEl efecto ha sido aplicado a tu cuenta de prestigio individual inmediatamente.`);
        await interaction.editReply({ embeds: [embed] });
    }
};
