require('dotenv').config();

const { Client } = require('discord.js')
const client = new Client();
var moves = new Map();
client.on('ready', () => {
    console.log("Login successful");
});

client.on('message', (message) => {
    console.log("Messsage received : ", message.content);
    if(message.content === "start") {
        message.channel.send("hey");
        moves.clear();
    } else if(message.content === "end") {
        console.log(moves);
        const sorted = new Map([...moves.entries()].sort((a, b) => b[1] - a[1]));
        console.log("This is sorted " ,sorted);
        const maxValue = sorted.values().next().value;
        const solList = new Array();
        console.log("This is amaxxx " ,maxValue);
        for (let [key, value] of sorted) {
                if(value<maxValue)
                break;
                else
                solList.push(key);
            }
        console.log("This is amaxxx " ,solList);
        const valueSet = solList.map((item, i) => `${i + 1}. ${item}`).join("\n");
        console.log("bhejo:",valueSet);
        message.channel.send(valueSet);
        
    } else {
        var move = message.content.toLowerCase();
        console.log(move);
        if(moves.get(move) === undefined) {
            moves.set(move,1);
        } else {
            var addedMoves = moves.get(move)+1;
            moves.set(move,moves.get(move)+1);
        }
        
        console.log(moves.get(move));
    }
})

client.login(process.env.DISCORD_BOT_TOKEN);