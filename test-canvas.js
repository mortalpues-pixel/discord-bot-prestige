const fs = require('fs');
const { generateProfileCard } = require('./utils/cardGenerator.js');

async function test() {
    console.log("Starting test...");
    const mockUser = {
        username: 'DAVID',
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    
    try {
        const buffer = await generateProfileCard(mockUser, 850, 150);
        fs.writeFileSync('test_card.png', buffer);
        console.log('Successfully saved test_card.png');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
