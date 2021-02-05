require('dotenv').config();

const { Client } = require('discord.js')
const client = new Client();
var moves = new Map();
var userVoted = new Map();
var colorMap = new Map();
colorMap[0] = "white";
colorMap[1] = "black";

var ctr=0;
client.on('ready', () => {
    console.log("Login successful");
});
const startMessage="hey, get started with the moves!";
client.on('message', (message) => {
    console.log("Messsage received : ", message.content);
    if(message.content === "!reset") {
       ctr=0;
    } else if(message.content === "!start") {
        message.channel.send(startMessage);
        moves.clear();
        userVoted.clear();

    } else if(message.content === "!stop") {
        //console.log(moves);
        ctr = (ctr+1)%2;
        const sorted = new Map([...moves.entries()].sort((a, b) => b[1] - a[1]));
        console.log("This is sorted " ,sorted);
        const maxValue = sorted.values().next().value;
        const solList = new Array();
       // console.log("This is amaxxx " ,maxValue);
        for (let [key, value] of sorted) {
                if(value<maxValue)
                break;
                else
                solList.push(key);
            }
        //console.log("This is amaxxx " ,solList);
        var valueSet = solList.map((item, i) => `${i + 1}. ${item} - ${maxValue} votes`).join("\n");
        console.log("bhejo:",valueSet.length);
        if(valueSet.length===0)
        valueSet = "No moves!"
        valueSet="**"+valueSet+"**";
        message.channel.send(valueSet);

    } else {
        console.log(message.member.roles.cache.some(r=>[colorMap[ctr]].includes(r.name))+" : Ctr is : "+ctr);
        var words= message.content.split(" ");
        console.log("Words :" +words);
        if(words[0] === "!v" && message.member.roles.cache.some(r=>[colorMap[ctr]].includes(r.name))) {
        var move = words[1];
        console.log("Move is :"+move);
        if(move !== startMessage) {
            if(userVoted.get(message.author) === undefined) {
                userVoted.set(message.author,1);
                if(moves.get(move) === undefined) {
                    moves.set(move,1);
                } else {
                    var addedMoves = moves.get(move)+1;
                    moves.set(move,moves.get(move)+1);
                }
            } else {
                message.reply("you have already voted this the move! :)");
            }
        }
    }

    }
})

client.login(process.env.DISCORD_BOT_TOKEN);
