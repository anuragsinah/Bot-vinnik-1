require('dotenv').config();

const { Client } = require('discord.js');
const admin=require('firebase-admin');
const client = new Client();
var movesCount = new Map();
var userVoted = new Map();
const { Chess } = require('chess.js');

const chess = new Chess()

var gameInProgress = false;

var serviceAccount = {
  "type": "service_account",
  "project_id": process.env.project_id,
  "private_key_id": process.env.private_key_id,
  "private_key": process.env.private_key.replace(/\\n/g, '\n'),
  "client_email": process.env.client_email,
  "client_id": process.env.client_id,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.client_x509_cert_url
};

var userPermissionApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

let db = userPermissionApp.firestore();

client.on('ready', () => {
    console.log("Login successful");
     getCollection();
});

async function getCollection(){
	console.log('startSnapshortUser');
  var snapshot  = await	db.collection('chessBot').get();
 snapshot.forEach(doc => {
   if(doc.id == 'pgn'){
     if(doc.data()['pgn'] != ''){
       chess.reset();
       gameInProgress = true;
       var pgn = [doc.data()['pgn']];
       chess.load_pgn(pgn.join('\n'));
       if(isGameOver()){
         gameInProgress = false;
       }
     }
   }
   else if (doc.id == 'chess') {
     userVoted = new Map(Object.entries(doc.data()['userVoted']))
     movesCount = new Map(Object.entries(doc.data()['movesCount']))
   }
 });
}

async function updateDataToFirebase(){
  try{
    userVotedObj = Object.fromEntries(userVoted);
    movesCountObj =  Object.fromEntries(movesCount);
    console.log("updateDataToFirebase");
    var obj = {pgn : chess.pgn()}
    console.log(obj);
    await db.collection('chessBot').doc('pgn').set(obj, { merge: true })
    await db.collection('chessBot').doc('chess').set({ userVoted: userVotedObj, movesCount: movesCountObj }, { merge: true });
    console.log("updateDataToFirebase done");
  }
	catch(err){
    console.error(err);
  }
}

const startGameMessage="hey, get started with the moves!";
const stopGameMessage="The current game has been stopped by an Arbiter!";
const wrongMoveMessage = "Wrong move. Please use SAN notation"
const gameNotInProgressMessage = "Sorry currently no game is in progress."

let stoppingArbiterID = '';

const reactionFilter = (reaction, user) =>{
  return reaction.emoji.name === '✅' &&  user.id === stoppingArbiterID;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function isWhiteTeam (message){
  return message.member.roles.cache.some(r=>["white"].includes(r.name.toLowerCase()))
}

function isBlackTeam (message){
  return message.member.roles.cache.some(r=>["black"].includes(r.name.toLowerCase()))
}

function isArbiter (message) {
  return message.member.roles.cache.some(r=>["arbiter"].includes(r.name.toLowerCase()))
}

function countVote(message,move){
  if(userVoted.get(message.author.id) === undefined){
    userVoted.set(message.author.id,1);
    console.log(userVoted);
    if(movesCount.get(move) === undefined){
      movesCount.set(move,1);
      return true;
    }else {
      var addedMoves = movesCount.get(move)+1;
      movesCount.set(move,movesCount.get(move)+1);
      return true;
    }
  }else {
    return false;
  }
}

function isValidMove(move){
  moved = chess.move(move)
  if(moved == null){
     return false;
  }
  else{
    chess.undo()
    return true;
  }
}

function sendMessageWithBoard(message,messageText){
  // imageGenerator.loadFEN(chess.fen())
  // imageGenerator.generatePNG('../chess.png')
  // setTimeout(() => { images("../puzzle.png")                     //Load image from file
  //                                         //加载图像文件
  //     //.size(520)                          //Geometric scaling the image to 400 pixels width
  //                                         //等比缩放图像到400像素宽
  //     .draw(images("../chess.png"), 29, 29)   //Drawn logo at coordinates (10,10)
  //                                         //在(10,10)处绘制Logo
  //     .save("../output.png", {               //Save the image to a file,whih quality 50
  //         quality : 100                    //保存图片到文件,图片质量为50
  //     });
  // }, 1000);
  // setTimeout(() => { return message.channel.send( messageText, {
  //       files: [
  //           "../output.png"
  //       ]
  //   });
  // }, 1000);
  var imageURL;
  var turn = chess.turn()
  if(chess.turn() == 'b'){
    imageURL = "https://chessboardimage.com/"+chess.fen()+"-flip.png";
  }
  else{
    imageURL = "https://chessboardimage.com/"+chess.fen()+".png"
  }
  console.log(imageURL);
  return  message.channel.send(messageText, {
    files: [
      imageURL
    ]
    });
}

function isGameOver(){
  return chess.game_over()
}

function gameOverMessage(message) {
  gameInProgress = false
  if(chess.in_checkmate()){
    return sendMessageWithBoard(message,"**Wow, it's a mate!! 🏆**");
  }
  else if (chess.in_stalemate()) {
    return sendMessageWithBoard(message,"**Sorry, you have drawn the match by stalemate.**");
  }
  else if (chess.in_threefold_repetition()) {
    return sendMessageWithBoard(message,"**Match has been drawn by ThreefoldRepetition.**");
  }
  else if (chess.insufficient_material()) {
    return sendMessageWithBoard(message,"**Match has been drawn by insufficientMaterial.**");
  }
  else if (chess.inDraw()) {
    return sendMessageWithBoard(message,"**Match has been drawn.**");
  }
}

client.on('message', (message) => {
    if(message.author.bot){
       if(message.content === 'Are you sure you want to stop the game? React on this message with ✅ to continue.'){
         message.react('✅')
          message.awaitReactions(reactionFilter, { max: 1, time: 60000, errors: ['time'] })
          .then(collected => {
            const reaction = collected.first();

            if (reaction.emoji.name === '✅') {
               chess.reset()
               movesCount.clear();
               userVoted.clear();
               gameInProgress = false;
               updateDataToFirebase();
               message.channel.send(stopGameMessage);
               message.react('👍')
            }
          })
          .catch(collected => {
            message.channel.send('The aribter who wanted to stop the game didn\'t react with ✅. Continuing the game.');
          });
       }
       else{
         return;
       }
     }
     console.log("Messsage received : ", message.content);
     message.content = message.content+" ."

     const PREFIX = '';
     let args = message.content.substring(PREFIX.length).split(" ");
     args[0] = args[0].toLowerCase();
     console.log(args[0]);
     if(args[0] === 'c.startgame' || args[0] === 'c.sg'){
       if(isArbiter(message)){
         if(!gameInProgress){
           chess.reset()
           movesCount.clear();
           userVoted.clear();
           gameInProgress = true;
           updateDataToFirebase();
           return sendMessageWithBoard(message,startGameMessage);
         }
         else{
           message.channel.send('Game is already in progress. Please stop the game first by using ```c.eg```')
         }
       }
       else{
         message.react("❌")
       }
     }
     else if (args[0] === 'c.endgame' || args[0] === 'c.eg') {
       if(isArbiter(message)){
         if(gameInProgress){
           message.channel.send('Are you sure you want to stop the game? React on this message with ✅ to continue.')
           stoppingArbiterID = message.author.id;
         }
         else{
            message.channel.send('No game in progress. Please start the game first by using ```c.sg```')
         }
       }
       else{
         message.react("❌")
       }
     }
     else if (args[0] === 'c.undo' || args[0] === 'c.u') {
       if(isArbiter(message)){
         if(gameInProgress){
           chess.undo()
           movesCount.clear();
           userVoted.clear();
           updateDataToFirebase();
           return sendMessageWithBoard(message,"Last move has been undone. And vote count has been reset.");
         }
         else{
           message.reply(gameNotInProgressMessage);
         }
       }
       else{
         message.react("❌")
       }
     }
     else if (args[0] === 'c.forcemove' || args[0] === 'c.fm') {
       if(isArbiter(message)){
         if(gameInProgress){
           move = chess.move(args[1])
           console.log(move);
           if(move == null){
              message.reply(wrongMoveMessage + ". You can still continue voting.");
           }
           else{
             movesCount.clear();
             userVoted.clear();
             var gameOver = isGameOver();
             updateDataToFirebase();
             if(gameOver){
               return gameOverMessage(message);
             }
             else{
               return sendMessageWithBoard(message,"Move has been made. Voting count has been reset");
             }
           }
         }
         else{
           message.reply(gameNotInProgressMessage)
         }
       }
       else {
         message.react("❌")
       }
     }
     else if (args[0] === 'c.stopvote' || args[0] === 'c.sv') {
       if(isArbiter(message)){
       if(gameInProgress){
          const sorted = new Map([...movesCount.entries()].sort((a, b) => b[1] - a[1]));
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
          var valueSet = solList.map((item, i) => `${i + 1}. ${item} - ${maxValue} votes`).join("\n");
          if (solList.length ==0){
            message.channel.send("No voted moves present to be played");
          }
          else if (solList.length == 1 ) {
            chess.move(solList[0])
            movesCount.clear();
            userVoted.clear();
            var gameOver = isGameOver();
            updateDataToFirebase();
            if(gameOver){
              return gameOverMessage(message);
            }
            else{
              return sendMessageWithBoard(message,solList[0] + " has been played."+'```'+valueSet+'```');
            }
          }
          else {
            var randomInt = getRandomInt(solList.length);
            console.log("randomInt",randomInt);
            chess.move(solList[randomInt])
            movesCount.clear();
            userVoted.clear();
            var gameOver = isGameOver();
            updateDataToFirebase();
            if(gameOver){
              return gameOverMessage(message);
            }
            else{
              return sendMessageWithBoard(message,solList[randomInt] + " has been played."+'```'+valueSet+'```');
            }
          }
        }
        else {
          message.reply(gameNotInProgressMessage)
        }
      }
      else{
        message.react("❌")
      }
     }
     else if (args[0] === 'c.vote' || args[0] === 'c.v') {
       if(gameInProgress){
         var currentTurn = chess.turn()
         if(currentTurn === 'b'){
           if(isBlackTeam(message)){
             move = args[1]
             var validMove = isValidMove(move)
             if(validMove){
               var isCounted = countVote(message,move)
               updateDataToFirebase();
               if(isCounted){
                 message.react("✅")
               }
               else{
                 message.react("🚫")
               }
             }
             else{
               message.react("❌")
             }
           }
           else{
            message.react("❗")
           }
         }
         else if (currentTurn === 'w') {
           if(isWhiteTeam(message)){
             move = args[1]
             var validMove = isValidMove(move)
             if(validMove){
               var isCounted = countVote(message,move)
               updateDataToFirebase();
               if(isCounted){
                 message.react("✅")
               }
               else{
                 message.react("🚫")
               }
             }
             else{
               message.react("❌")
             }
           }
           else{
            message.react("❗")
           }
         }
         else {
           message.reply("Sorry we are not able to determine the game. Please ask organizer to restart the game.")
         }
       }
       else {
         message.reply(gameNotInProgressMessage);
       }
     }
     else if (args[0] === 'c.history' || args[0] === 'c.h') {
       if(gameInProgress){
         if(chess.pgn().length==0){
           message.reply("No moves has been made till now");
         }
         else{
           message.channel.send('\n```'+chess.pgn()+'```'+'\n You can analysis it here. https://lichess.org/analysis by pasting it to PGN');
         }
       }
       else{
         message.reply(gameNotInProgressMessage);
       }
     }
     else if (args[0] === 'c.votecount' || args[0] === 'c.vc') {
       if(gameInProgress){
         console.log(movesCount);
         const sorted = new Map([...movesCount.entries()].sort((a, b) => b[1] - a[1]));
         console.log("This is sorted " ,sorted);
         const maxValue = sorted.values().next().value;
         const solList = new Array();
         for (let [key, value] of sorted) {
                 if(value<maxValue)
                 break;
                 else
                 solList.push(key);
         }
         var valueSet = solList.map((item, i) => `${i + 1}. ${item} - ${maxValue} votes`).join("\n");
         if(valueSet.length===0){
           message.channel.send("No, moves has been voted");
         }
         else {
           message.channel.send('```'+valueSet+'```');
         }
       }
       else{
         message.reply(gameNotInProgressMessage);
       }
     }

     else if (args[0] === 'c.showboard' || args[0] === 'c.sb') {
       if(gameInProgress){
         return sendMessageWithBoard(message,'')
       }
       else{
         message.reply(gameNotInProgressMessage);
       }
     }
})
client.login(process.env.DISCORD_BOT_TOKEN);
