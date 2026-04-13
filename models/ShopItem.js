const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    type: { type: String, required: true }, // 'multiplier' or 'medal'
    name: { type: String, required: true },
    price: { type: Number, required: true },
    
    // Multiplier specific
    multiplier_value: { type: Number, default: null },
    multiplier_uses: { type: Number, default: null },
    
    // Medal specific
    emoji: { type: String, default: null },
    color: { type: String, default: null },
    
    // Limits
    stock: { type: Number, default: null },
    
    // Visibility
    isVisible: { type: Boolean, default: true }
});

module.exports = mongoose.model('ShopItem', shopItemSchema);
