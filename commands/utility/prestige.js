const { SlashCommandBuilder, AttachmentBuilder, InteractionContextType } = require('discord.js');
const db = require('../../database.js');
const { createCrownEmbed } = require('../../utils/embeds.js');
const { generateProfileCard } = require('../../utils/cardGenerator.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestigio')
        .setDescription('Muestra el prestigio de un miembro de la Corte.')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Miembro a consultar (opcional)')),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        let targetMember = null;
        let rankName = 'Ciudadano';

        if (interaction.guild) {
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
                const highestRole = targetMember.roles.cache
                    .filter(r => r.name !== '@everyone')
                    .sort((a, b) => b.position - a.position)
                    .first();
                if (highestRole) rankName = highestRole.name;
            } catch (e) {
                console.warn('Could not fetch member:', e.message);
            }
        }

        const userData = await db.getUserData(targetUser.id);
        const subject = targetMember ?? targetUser;
        const displayName = targetMember?.displayName || targetUser.globalName || targetUser.username;

        try {
            const cardBuffer = await generateProfileCard(
                {
                    displayName,
                    username: targetUser.username,
                    displayAvatarURL: opts => subject.displayAvatarURL(opts)
                },
                rankName,
                userData
            );
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'prestigio.png' });
            return interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error('Error generating profile card:', error);

            const embed = createCrownEmbed({
                title: 'Prestigio',
                description: `Miembro: <@${targetUser.id}>\nRango: **${rankName}**`,
                tone: 'gold',
                footer: 'Modo editorial'
            }).addFields(
                { name: 'Prestigio acumulado', value: `**${userData.prestige}** pts`, inline: true },
                { name: 'Prestigio semanal', value: `**+${userData.weekly_prestige}** pts`, inline: true }
            );
            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        }
    }
};
