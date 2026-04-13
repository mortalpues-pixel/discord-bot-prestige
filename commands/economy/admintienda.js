const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admintienda')
        .setDescription('Añade un objeto a la tienda de prestigio (Solo Administradores).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcmd => 
            subcmd.setName('multiplicador')
            .setDescription('Añade un multiplicador de prestigio.')
            .addStringOption(opt => opt.setName('id').setDescription('ID único (ej: mult2x_3)').setRequired(true))
            .addStringOption(opt => opt.setName('nombre').setDescription('Nombre a mostrar la tienda').setRequired(true))
            .addIntegerOption(opt => opt.setName('precio').setDescription('Precio en prestigio').setRequired(true))
            .addNumberOption(opt => opt.setName('valor').setDescription('El valor a multiplicar (ej: 2 o 1.5)').setRequired(true))
            .addIntegerOption(opt => opt.setName('usos').setDescription('Cantidad de veces que aplica antes de expirar').setRequired(true))
            .addIntegerOption(opt => opt.setName('stock').setDescription('Cantidad disponible (vacío = infinito)').setRequired(false))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('medalla')
            .setDescription('Añade una medalla comprable a la tienda.')
            .addStringOption(opt => opt.setName('id').setDescription('ID único (ej: medal_veterano)').setRequired(true))
            .addStringOption(opt => opt.setName('nombre').setDescription('Nombre a mostrar la tienda').setRequired(true))
            .addIntegerOption(opt => opt.setName('precio').setDescription('Precio en prestigio').setRequired(true))
            .addStringOption(opt => opt.setName('emoji').setDescription('Emoji de la medalla (copiar y pegar)').setRequired(true))
            .addIntegerOption(opt => opt.setName('stock').setDescription('Cantidad disponible (vacío = infinito)').setRequired(false))
            .addStringOption(opt => opt.setName('color').setDescription('Código de color hexadecimal (ej: #FFD700)').setRequired(false))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('eliminar')
            .setDescription('Quita un objeto de la tienda (seguirá existiendo en los perfiles de los dueños).')
            .addStringOption(opt => opt.setName('id').setDescription('ID del objeto a eliminar').setRequired(true))
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();
        const itemId = interaction.options.getString('id').replace(/[^a-zA-Z0-9_-]/g, '');

        if (sub === 'eliminar') {
            try {
                const item = await db.getShopItem(itemId);
                if (!item) {
                    return interaction.editReply(`❌ No se encontró ningún objeto con la ID \`${itemId}\`.`);
                }
                
                await db.updateShopItemVisibility(itemId, false);
                await interaction.editReply(`✅ El objeto **${item.name}** (\`${itemId}\`) ha sido retirado de la tienda. Los usuarios que ya lo tengan lo conservarán.`);
            } catch (e) {
                console.error('Error removing shop item:', e);
                await interaction.editReply(`❌ Hubo un error al retirar el objeto de la tienda.`);
            }
            return;
        }

        const nombre = interaction.options.getString('nombre');
        const precio = interaction.options.getInteger('precio');
        const stock = interaction.options.getInteger('stock');
        const color = interaction.options.getString('color');

        const itemData = {
            itemId,
            name: nombre,
            price: precio,
            type: sub === 'multiplicador' ? 'multiplier' : 'medal',
            stock: stock !== null ? stock : null
        };

        if (sub === 'multiplicador') {
            itemData.multiplier_value = interaction.options.getNumber('valor');
            itemData.multiplier_uses = interaction.options.getInteger('usos');
        } else if (sub === 'medalla') {
            itemData.emoji = interaction.options.getString('emoji');
            itemData.color = color;
        }

        try {
            await db.addShopItem(itemData);
            await interaction.editReply(`✅ El objeto **${nombre}** (ID: \`${itemId}\`) ha sido añadido a la tienda con éxito.`);
        } catch (e) {
            console.error('Error adding shop item:', e);
            await interaction.editReply(`❌ Hubo un error al crear el objeto. Verifica que el ID no exista ya en la tienda.`);
        }
    }
};
