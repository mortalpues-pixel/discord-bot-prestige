const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database.js');
const config = require('../../config.js');
const { createPremiumEmbed } = require('../../utils/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aprobar')
        .setDescription('Comandos de administración para aprobar misiones.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('lista')
                .setDescription('Lista las entregas pendientes.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('confirmar')
                .setDescription('Aprueba una entrega específica.')
                .addIntegerOption(option => option.setName('id').setDescription('ID de la entrega').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rechazar')
                .setDescription('Rechaza una entrega específica.')
                .addIntegerOption(option => option.setName('id').setDescription('ID de la entrega').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('detalles')
                .setDescription('Ver todos los detalles y fotos de una entrega.')
                .addIntegerOption(option => option.setName('id').setDescription('ID de la entrega').setRequired(true))),
    async execute(interaction) {
        const logo = new AttachmentBuilder(config.branding.logoPath);

        const highCommandRole = process.env.HIGH_COMMAND_ROLE_ID;
        if (highCommandRole && !interaction.member.roles.cache.has(highCommandRole)) {
            const embed = createPremiumEmbed('❌ Error', 'No tienes permiso (Alto Mando) para usar esto.');
            return interaction.reply({ embeds: [embed], files: [logo], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'lista') {
            const submissions = await db.getPendingSubmissions();
            if (submissions.length === 0) {
                const embed = createPremiumEmbed('📝 Entregas Pendientes', 'No hay entregas pendientes.');
                return interaction.reply({ embeds: [embed], files: [logo] });
            }

            const fields = submissions.slice(0, 10).map(s => {
                const mission = config.missions.find(m => m.key === s.mission_key);

                // Handle array proofs for display
                const proofs = Array.isArray(s.proof_content) ? s.proof_content : [s.proof_content];
                const proofLinks = proofs.map((url, index) => `[Img ${index + 1}](${url})`).join(' | ');

                return {
                    name: `🆔 **${s.id}** | Usuario: <@${s.user_id}>`,
                    value: `**Misión**: ${mission ? mission.description : s.mission_key}\n**Pruebas**: ${proofs.length} total - ${proofLinks}`
                };
            });

            const embed = createPremiumEmbed('📝 Entregas Pendientes', 'Lista de las últimas entregas pendientes.')
                .addFields(fields);

            return interaction.reply({ embeds: [embed], files: [logo], ephemeral: true });

        } else if (subcommand === 'confirmar' || subcommand === 'rechazar') {
            const id = interaction.options.getInteger('id');
            const submission = await db.getSubmission(id);

            if (!submission) {
                const embed = createPremiumEmbed('❌ Error', 'No se encontró una entrega con ese ID.');
                return interaction.reply({ embeds: [embed], files: [logo], ephemeral: true });
            }

            if (submission.status !== 'pending') {
                const embed = createPremiumEmbed('⚠️ Aviso', `Esta entrega ya está **${submission.status}**.`);
                return interaction.reply({ embeds: [embed], files: [logo], ephemeral: true });
            }

            if (subcommand === 'confirmar') {
                let reward = submission.reward_snapshot || 0;

                // Fallback for old submissions without snapshot
                if (!reward) {
                    const mission = config.missions.find(m => m.key === submission.mission_key);
                    reward = mission ? mission.reward : 10;
                }

                await db.addUserPrestige(submission.user_id, reward);
                await db.updateSubmissionStatus(id, 'approved');

                try {
                    const user = await interaction.client.users.fetch(submission.user_id);
                    const dmEmbed = createPremiumEmbed('✅ Misión Aprobada', `Has ganado **${reward}** puntos de prestigio.`);
                    await user.send({ embeds: [dmEmbed], files: [logo] });
                } catch (e) {
                    console.log('No se pudo enviar DM al usuario.');
                }

                const embed = createPremiumEmbed('✅ Aprobado', `Entrega **#${id}** aprobada.\nSe han otorgado **${reward}** puntos a <@${submission.user_id}>.`);
                return interaction.reply({ embeds: [embed], files: [logo] });
            } else {
                await db.updateSubmissionStatus(id, 'rejected');
                const embed = createPremiumEmbed('❌ Rechazado', `Entrega **#${id}** rechazada.`);
                return interaction.reply({ embeds: [embed], files: [logo] });
            }
        } else if (subcommand === 'detalles') {
            const id = interaction.options.getInteger('id');
            const submission = await db.getSubmission(id);

            if (!submission) {
                const embed = createPremiumEmbed('❌ Error', 'No se encontró una entrega con ese ID.');
                return interaction.reply({ embeds: [embed], files: [logo], ephemeral: true });
            }

            const mission = config.missions.find(m => m.key === submission.mission_key);
            const proofs = Array.isArray(submission.proof_content) ? submission.proof_content : [submission.proof_content];

            const mainEmbed = createPremiumEmbed(`🆔 Detalles Entrega #${id}`, `De: <@${submission.user_id}>`)
                .addFields(
                    { name: '📋 Misión', value: mission ? mission.description : submission.mission_key },
                    { name: '📌 Estado', value: `**${submission.status.toUpperCase()}**`, inline: true },
                    { name: '💎 Recompensa', value: `${submission.reward_snapshot} puntos`, inline: true },
                    { name: '📷 Pruebas', value: `${proofs.length} imagen(es)` }
                );

            // Create auxiliary embeds for the images to show them in a grid/stack
            const embeds = [mainEmbed];

            // Add images. Discord allows up to 10 embeds per message, and will group them if they have the same URL (if using dummy embeds)
            // or just stack them. Here we use the images for each one.
            proofs.forEach((url, index) => {
                if (index === 0) {
                    mainEmbed.setImage(url);
                } else {
                    const imgEmbed = createPremiumEmbed('', '')
                        .setURL(url) // Some browsers/Discord clients group embeds by URL
                        .setImage(url);
                    embeds.push(imgEmbed);
                }
            });

            return interaction.reply({ embeds: embeds.slice(0, 10), files: [logo], ephemeral: true });
        }
    },
};
