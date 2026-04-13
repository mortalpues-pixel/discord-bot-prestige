const role = "👑 Primer Señor de la Familia";
const cleaned = role.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_.,()[\]]/g, '').trim();
console.log("Cleaned:", cleaned);
