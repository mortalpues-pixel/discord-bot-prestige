const { PermissionFlagsBits } = require('discord.js');

/**
 * Comprueba si un miembro tiene un rol concreto.
 * Soporta tanto GuildMember (roles.cache) como payload crudo (array de IDs).
 */
function hasRole(member, roleId) {
    const target = String(roleId || '').trim();
    if (!target || !member || !member.roles) return false;

    if (member.roles.cache && typeof member.roles.cache.has === 'function') {
        return member.roles.cache.has(target);
    }
    if (Array.isArray(member.roles)) {
        return member.roles.includes(target);
    }
    return false;
}

/**
 * ¿Pertenece el miembro al Alto Mando?
 * Falla CERRADO: si HIGH_COMMAND_ROLE_ID no está configurado, solo pasan los administradores.
 */
function isHighCommand(member) {
    if (!member) return false;
    if (member.permissions && typeof member.permissions.has === 'function'
        && member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    return hasRole(member, process.env.HIGH_COMMAND_ROLE_ID);
}

module.exports = { hasRole, isHighCommand };
