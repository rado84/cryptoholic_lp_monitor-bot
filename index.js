require('dotenv').config()
const web3=require('@solana/web3.js')
const { fork } = require('child_process');
const path = require('path');
const readline=require("readline")
const fs=require('fs');
const {Bot,Context,session}=require("grammy")
const { Menu } = require("@grammyjs/menu");
const {
    conversations,
    createConversation,
} = require("@grammyjs/conversations");
const { TOKEN_PROGRAM_ID, AccountLayout } = require('@solana/spl-token');
const {  LIQUIDITY_STATE_LAYOUT_V4, Liquidity,MARKET_STATE_LAYOUT_V3,Market,poolKeys2JsonInfo} = require('@raydium-io/raydium-sdk');
const WebSocket = require('ws');
const Client=require("@triton-one/yellowstone-grpc");
const { pumpfunSwapTransaction, getSwapMarketRapid } = require('./utils');
const bs58=require("bs58");
const { swapTokenTestBuy } = require('./swap');

const client =new Client.default("http://185.209.179.175:10005/", "");

function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}


const connection = new web3.Connection(process.env.RPC_API);//Web3.js Connection
const helius_connection=new web3.Connection(process.env.HELIUS_RPC);

const signatures=[];
const monitorProcesses={}
const newPoolMonitorProcesses={};
const pumpfunProcesses={};

const monitorProcessPath=path.resolve(__dirname,"monitor.js");
const newPoolMonitorProcessPath=path.resolve(__dirname,"newPoolMonitor.js");
const pumpfunMonitorPath=path.resolve(__dirname,"pumpfunMonitor.js")

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new web3.PublicKey(SOL_MINT_ADDRESS);
const RAYDIUM_OPENBOOK_AMM=new web3.PublicKey(process.env.RAYDIUM_OPENBOOK_AMM);
const raydium_program_id=new web3.PublicKey(process.env.RAYDIUM_OPENBOOK_AMM);



if(!fs.existsSync(path.resolve(__dirname,"logs"))){
    fs.mkdirSync(path.resolve(__dirname,"logs"));
}

var geyserSignatures=[];
var geyserProcesses={}


const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const botClients=[7346227798];

bot.api.setMyCommands([
    { command: "start", description: "Start LP monitoring" },
    { command: "configure", description: "Configure filter paramters" },
    { command: "finish", description: "Stop LP monitoring" },
]);

const menu = new Menu("configure-menu")
  .text("Market Cap", (ctx) => ctx.reply("You pressed A!")).row()
  .text("Liquidity", (ctx) => ctx.reply("You pressed B!"));

bot.command("start", async (ctx) => {
    // if(botClients.some(client=>client==ctx.chatId)) return;
    ctx.reply("Registered!!!")
    botClients.push(ctx.chatId)
});
bot.use(menu);
bot.command("configure", async (ctx) => {
    await ctx.reply("Please select field what you want to configure:", { reply_markup: menu });
});
bot.command("finish",ctx=>{
    const chatIdIndex=botClients.findIndex(client=>client==ctx.chatId);
    botClients.splice(chatIdIndex,1);
})


client.getVersion()
.then(async version=>{
    console.log(version)
    const stream =await client.subscribe();

    stream.on("data", async (data) => {
        // console.log(data.transaction.transaction.meta)
        if(data.transaction&&data.transaction.transaction&&data.transaction.transaction.signature) {
            const sig=bs58.encode(data.transaction.transaction.signature)
            const transaction=data.transaction.transaction;
            // console.log(transaction.meta.logMessages)
            if(transaction.meta.logMessages.some(log=>log.includes("initialize2"))){
                var raydiumPoolProgramIndex=0;
                transaction.transaction.message.accountKeys.map((account,index)=>{
                    if(bs58.encode(account)==process.env.RAYDIUM_OPENBOOK_AMM){
                        raydiumPoolProgramIndex=index;
                    }
                })
                // console.log({initialzed:sig})
                const accounts = (transaction?.transaction.message.instructions).find(instruction =>instruction.programIdIndex==raydiumPoolProgramIndex ).accounts;
                console.log(accounts[8],accounts[9])
                // if (!accounts) {
                //     console.log("No accounts found in the transaction.");
                //     return;
                // }

                // const tokenAIndex = 8;
                // const tokenBIndex = 9;

                // const tokenAAccount = accounts[tokenAIndex];
                // const tokenBAccount = accounts[tokenBIndex];
                // const targetToken=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?tokenBAccount.toBase58():tokenAAccount.toBase58();
                // const quoted=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?true:false;
                // const tokenInfoData=await connection.getParsedAccountInfo(new web3.PublicKey(targetToken));
                // const tokenInfo=tokenInfoData.value.data.parsed.info;
                // console.log({targetToken,quoted})
                // if(tokenInfo.freezeAuthority) {
                //     console.log("FROZEN From GEYSER!!!")
                //     return;
                // }
                // if(tokenInfo.mintAuthority) {
                //     console.log("NOT RENOUNCED FROM GEYSER!!!")
                //     return;
                // }
                // let swapmarket=await getSwapMarketRapid(targetToken,quoted);
                // if(!swapmarket) {
                //     await sleep(200)
                //     swapmarket=await getSwapMarketRapid(targetToken,quoted);
                //     if(!swapmarket) {
                //         await sleep(200)
                //         swapmarket=await getSwapMarketRapid(targetToken,quoted);
                //         if(!swapmarket) {
                //             await sleep(200)
                //             swapmarket=await getSwapMarketRapid(targetToken,quoted);
                //             if(!swapmarket) {
                //                 await sleep(200)
                //                 swapmarket=await getSwapMarketRapid(targetToken,quoted);
                //                 if(!swapmarket) {
                //                     console.log("NO SWAPMARKET!!!")
                //                     return;
                //                 }
                //             }
                //         }
                //     }
                // }
                // console.log(`https://solscan.io/tx/${sig}`)
                // // await swapTokenTestBuy(targetToken,swapmarket.poolKeys,100000)
                // const solVault=(swapmarket.poolInfo.baseMint.toString()==SOL_MINT_ADDRESS)?swapmarket.poolInfo.baseVault:swapmarket.poolInfo.quoteVault;
                // const solAmountData=await connection.getTokenAccountBalance(solVault,"processed");
                // const solAmount=solAmountData.value.uiAmount;
                // if(solAmount<80) {
                //     console.log("TO SMALL LP")
                //     return;
                // }
                // if(solAmount>600) {
                //     console.log("TOO BIG LP!!!")
                //     return;
                // }
                // botClients.forEach(oneClient=>{
                //     bot.api.sendMessage(oneClient,
                //     `<b>💥 New Pool from GEYSER 💥</b>\n\n<b>Mint : </b>\n<code>${targetToken}</code>\n\n<b>LP Value : </b><b>${solAmount}</b> SOL \n\n<a href="https://solscan.io/tx/${sig}" >LP</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${swapmarket.poolKeys.id.toString()}">Photon</a> | <a href="https://dexscreener.com/solana/${swapmarket.poolKeys.id.toString()}" >DexScreener</a> \n`,
                //     {parse_mode:"HTML",link_preview_options:{is_disabled:true}})
                // })
            }
        }
    });
    
    // Create a subscription request.
    const request =Client.SubscribeRequest.fromJSON({
        accounts: {},
        slots: {},
        transactions: {
            raydium: {
            vote: false,
            failed: false,
            signature: undefined,
            accountInclude: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"], //Address 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
            accountExclude: [],
            accountRequired: [],
            },
        },
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        accountsDataSlice: [],
        ping: undefined,
        commitment: Client.CommitmentLevel.CONFIRMED
    })

    // Sending a subscription request.
    await new Promise((resolve, reject) => {
    stream.write(request, (err) => {
        if (err === null || err === undefined) {
        resolve();
        } else {
        reject(err);
        }
    });
    }).catch((reason) => {
    console.error(reason);
    throw reason;
    });
});

const ws = new WebSocket(process.env.PUMPFUN_API);

ws.on('open', function open() {

    // Subscribing to token creation events
    let payload = {
        method: "subscribeNewToken", 
      }
    ws.send(JSON.stringify(payload));
});
  
ws.on('message', async (data)=> {
    const message=JSON.parse(data)
    if(message.txType=="create"){
        let payload = {
            method: "subscribeTokenTrade",
            keys: [message.mint] // array of token CAs to watch
        }
        ws.send(JSON.stringify(payload))
        // console.log(message)
        // await pumpfunSwapTransaction(message.mint,true);

        
        // if(pumpfunProcesses[message.mint]) {
        //     console.log("ALREADY MONITORING!!!")
        //     return;
        // }
        // pumpfunProcesses[message.mint]=fork(pumpfunMonitorPath);
        // console.log({number_of_pumpfun_processes:Object.keys(pumpfunProcesses).length})
        // pumpfunProcesses[message.mint].on("message",processMessage=>{
        //     if(processMessage.bought){
        //         payload={
        //             method: "unsubscribeTokenTrade",
        //             keys: [message.mint] // array of token CAs to watch
        //         }
        //         ws.send(JSON.stringify(payload))
        //         botClients.forEach(async oneClient=>{
        //             // await bot.api.sendPhoto(oneClient,message.image);
        //             bot.api.sendMessage(oneClient,
        //                 `<b>💊 Buy on Pump.fun 💊</b>\n\n<b>Name : </b><b>${processMessage.name}</b>\n<b>Description : </b>\n<b>${processMessage.description}</b>\n<b>Symbol : </b><b>${processMessage.symbol}</b>\n\n<b>SOL on BondingCurve</b> : <b>${processMessage.solAmount}</b> SOL\n<b>Number of Buy Trades : </b><b>${processMessage.numberOfBuyTrades}</b>/${processMessage.numberOfTrades}\n\n<b>Mint : </b>\n\n<code>${message.mint}</code>\n\n<a href="https://solscan.io/token/${message.mint}">Solscan</a> | <a href="https://solscan.io/token/${message.bondingCurveKey}">BondingCurve</a> | <a href="https://pump.fun/${message.mint}">Pump.fun</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.bondingCurveKey}">Photon</a> \n`
        //                 ,{
        //                     parse_mode:"HTML",
        //                     link_preview_options:{
        //                         is_disabled:true
        //                     },
        //                 }
        //             );
                    
        //         })
        //     }
        // });
        // pumpfunProcesses[message.mint].on("exit",()=>{
        //     payload={
        //         method: "unsubscribeTokenTrade",
        //         keys: [message.mint] // array of token CAs to watch
        //     }
        //     ws.send(JSON.stringify(payload))
        //     delete pumpfunProcesses[message.mint];
        // })
        // pumpfunProcesses[message.mint].send({token:message.mint,...message})


        ///////////////////
        ///////////////
        // try {
        //     const tokenAssetRes=await fetch(`https://pumpportal.fun/api/data/token-info?ca=${message.mint}`);
        //     const tokenAsset=await tokenAssetRes.json();
        //     botClients.forEach(async oneClient=>{
        //         // await bot.api.sendPhoto(oneClient,message.image);
        //         bot.api.sendMessage(oneClient,
        //             `<b>💊 New Token on Pump.fun 💊</b>\n\n\n\n<b>Mint : </b>\n\n<code>${message.mint}</code>\n\n<a href="https://solscan.io/token/${message.mint}">Solscan</a> | <a href="https://solscan.io/token/${message.bondingCurveKey}">BondingCurve</a> | <a href="https://pump.fun/${message.mint}">Pump.fun</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.bondingCurveKey}">Photon</a> \n`
        //             ,{
        //                 parse_mode:"HTML",
        //                 link_preview_options:{
        //                     is_disabled:true
        //                 },
        //             }
        //         );
        //     })
        // } catch (error) {
        //     console.log(error)
        // }
        ///////////////////////
        ///////////////////////

    }else{
        if(!message.txType) return;
        // await pumpfunSwapTransaction(message.mint,false)
        if(message.marketCapSol&&message.marketCapSol>50){
            // console.log(message);
            payload={
                method: "unsubscribeTokenTrade",
                keys: [message.mint] // array of token CAs to watch
            }
            ws.send(JSON.stringify(payload))
        }
        // if(!pumpfunProcesses[message.mint]) return;
        // pumpfunProcesses[message.mint].send({token:message.mint,...message});
    }
});

// connection.onLogs(TOKEN_PROGRAM_ID,async ({logs,signature,err})=>{
//     if(logs.some(oneLog=>oneLog.includes("burn")||oneLog.includes("Burn")||oneLog.includes("burnChecked"))){
//         if(signature=="1111111111111111111111111111111111111111111111111111111111111111") return;
//         // console.log(`From Polling : ${signature}`)
//         if(signatures.some(sig=>sig==signature)) return;
//         signatures.push(signature)
//         if(signatures.length>100) signatures.shift();
//         // console.log(signature)
//         try {
//             const tx=await connection.getParsedTransaction(signature,{maxSupportedTransactionVersion:0});
//             const instruction= tx?.transaction?.message?.instructions.find(ix => {
//                 return ix?.parsed?.type=="burn"||ix?.parsed?.type=="Burn"||ix?.parsed?.type=="burnChecked"});
//             if(!instruction) return;
            
//             const mint=instruction.parsed.info.mint;
//             const totalSupply=await connection.getTokenSupply(new web3.PublicKey(mint));
//             // console.log(totalSupply.value)
//             if(totalSupply.value.uiAmount>0) {
//                 // console.log("NOT ALL BURNED TOKEN!!!");
//                 // console.log({amount: totalSupply.value, token:`https://solscan.io/token/${mint}`})
//                 return;
//             }
//             if(monitorProcesses[mint]) {
//                 // console.log("ALREADY MONITORING!!!")
//                 return;
//             }
//             monitorProcesses[mint]=true;
//             monitorProcesses[mint]=fork(monitorProcessPath);
//             monitorProcesses[mint].send({token:mint})
//             monitorProcesses[mint].on("message",async message=>{
//                 if(message.marketCap){
//                     botClients.forEach(async oneClient=>{
//                         // await bot.api.sendPhoto(oneClient,message.image);
//                         bot.api.sendMessage(oneClient,
//                             `<b>🔥 Burned Pool 🔥</b>\n\n<b>Name : </b><b>${message.name}</b>\n<b>Description : </b>\n<b>${message.description}</b>\n<b>Symbol : </b><b>${message.symbol}</b>\n\n<b>Liquidity : </b><b>${message.lpValue} SOL</b>\n<b>Market Cap : </b><b>${Number(message.marketCap).toFixed(2)} $</b>\n<b>Largest holdings : </b>\n<b>${message.largestHolders}</b> wallets are owning <b>${Number(message.largestHoldingsPercentage).toFixed(2)} %</b> \n\n<b>Mint : </b>\n\n<code>${message.token}</code>\n\n<a href="https://solscan.io/token/${mint}">Solscan</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.poolId}">Photon</a> | <a href="https://dexscreener.com/solana/${message.poolId}">DexScreener</a>\n`
//                             ,{
//                                 parse_mode:"HTML",
//                                 link_preview_options:{
//                                     is_disabled:true
//                                 },
//                             }
//                         );
                        
//                     })
                    
//                 }
//             })
//             monitorProcesses[mint].on("exit",(code)=>{
//                 delete monitorProcesses[mint];
//             })
//         } catch (error) {
//             console.log(error)
//         }
        
//     }
// })
// connection.onLogs(raydium_program_id,async ({logs,signature,err})=>{
//     // console.log(signature)
//     if(logs.some(log=>log.includes("initialize2"))){
//         try {
//             const tx=await connection.getParsedTransaction(signature,{maxSupportedTransactionVersion:0});
//             const accounts = (tx?.transaction.message.instructions).find(ix => ix.programId.toBase58() ===process.env.RAYDIUM_OPENBOOK_AMM).accounts;
            
//             if (!accounts) {
//                 console.log("No accounts found in the transaction.");
//                 return;
//             }

//             const tokenAIndex = 8;
//             const tokenBIndex = 9;

//             const tokenAAccount = accounts[tokenAIndex];
//             const tokenBAccount = accounts[tokenBIndex];
//             const targetToken=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?tokenBAccount.toBase58():tokenAAccount.toBase58();
//             const quoted=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?true:false;
            
//             newPoolMonitorProcesses[targetToken]=true;
//             newPoolMonitorProcesses[targetToken]=fork(newPoolMonitorProcessPath);
//             newPoolMonitorProcesses[targetToken].send({token:targetToken,quoted:quoted});
//             newPoolMonitorProcesses[targetToken].on("message",message=>{
//                 botClients.forEach(async oneClient=>{
//                     // await bot.api.sendPhoto(oneClient,message.image);
//                     bot.api.sendMessage(oneClient,
//                         `<b>⚡️ New Pool ⚡️</b>\n\n<b>Name : </b>${message.name}\n<b>Description : </b>\n${message.description}\n<b>Symbol : </b>${message.symbol}\n\n<b>Liquidity : </b><b>${message.lpValue} SOL</b>\n<b>Market Cap : </b><b>${Number(message.marketCap).toFixed(2)} $</b>\n<b>Largest holdings : </b>\n<b>${message.largestHolders}</b> wallets are owning <b>${Number(message.largestHoldingsPercentage).toFixed(2)} %</b> \n\n<b>Mint : </b>\n\n<code>${targetToken}</code>\n\n<a href="https://solscan.io/token/${message.lpMint}">Solscan</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.poolId}">Photon</a> | <a href="https://dexscreener.com/solana/${message.poolId}">DexScreener</a>\n`
//                         ,{
//                             parse_mode:"HTML",
//                             link_preview_options:{
//                                 is_disabled:true
//                             },
//                         }
//                     );
//                 })
//             })
//             newPoolMonitorProcesses[targetToken].on("exit",(code)=>{
//                 delete newPoolMonitorProcesses[targetToken];
//             })

//         } catch (error) {
//             console.log(error)
//         }
        
//     }
// })
// helius_connection.onLogs(TOKEN_PROGRAM_ID,async ({logs,signature,err})=>{
//     if(logs.some(oneLog=>oneLog.includes("burn")||oneLog.includes("Burn")||oneLog.includes("burnChecked"))){
//         if(signature=="1111111111111111111111111111111111111111111111111111111111111111") return;
//         // console.log(`From Polling : ${signature}`)
//         if(signatures.some(sig=>sig==signature)) return;
//         signatures.push(signature)
//         if(signatures.length>100) signatures.shift();
//         // console.log(signature)
//         try {
//             const tx=await connection.getParsedTransaction(signature,{maxSupportedTransactionVersion:0});
//             const instruction= tx?.transaction?.message?.instructions.find(ix => {
//                 return ix?.parsed?.type=="burn"||ix?.parsed?.type=="Burn"||ix?.parsed?.type=="burnChecked"});
//             if(!instruction) return;
            
//             const mint=instruction.parsed.info.mint;
//             const totalSupply=await connection.getTokenSupply(new web3.PublicKey(mint));
//             // console.log(totalSupply.value)
//             if(totalSupply.value.uiAmount>0) {
//                 // console.log("NOT ALL BURNED TOKEN!!!");
//                 // console.log({amount: totalSupply.value, token:`https://solscan.io/token/${mint}`})
//                 return;
//             }
//             if(monitorProcesses[mint]) {
//                 // console.log("ALREADY MONITORING!!!")
//                 return;
//             }
//             monitorProcesses[mint]=true;
//             monitorProcesses[mint]=fork(monitorProcessPath);
//             monitorProcesses[mint].send({token:mint})
//             monitorProcesses[mint].on("message",async message=>{
//                 if(message.marketCap){
//                     botClients.forEach(async oneClient=>{
//                         // await bot.api.sendPhoto(oneClient,message.image);
//                         bot.api.sendMessage(oneClient,
//                             `<b>🔥 Burned Pool 🔥</b>\n\n<b>Name : </b><b>${message.name}</b>\n<b>Description : </b>\n<b>${message.description}</b>\n<b>Symbol : </b><b>${message.symbol}</b>\n\n<b>Liquidity : </b><b>${message.lpValue} SOL</b>\n<b>Market Cap : </b><b>${Number(message.marketCap).toFixed(2)} $</b>\n<b>Largest holdings : </b>\n<b>${message.largestHolders}</b> wallets are owning <b>${message.largestHoldingsPercentage} %</b> \n\n<b>Mint : </b>\n\n<code>${message.token}</code>\n\n<a href="https://solscan.io/token/${mint}">Solscan</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.poolId}">Photon</a> | <a href="https://dexscreener.com/solana/${message.poolId}">DexScreener</a>\n`
//                             ,{
//                                 parse_mode:"HTML",
//                                 link_preview_options:{
//                                     is_disabled:true
//                                 },
//                             }
//                         );
                        
//                     })
                    
//                 }
//             })
//             monitorProcesses[mint].on("exit",(code)=>{
//                 delete monitorProcesses[mint];
//             })
//         } catch (error) {
//             console.log(error)
//         }
        
//     }
// })
// helius_connection.onLogs(raydium_program_id,async ({logs,signature,err})=>{
//     // console.log(signature)
//     if(logs.some(log=>log.includes("initialize2"))){
//         try {
//             const tx=await connection.getParsedTransaction(signature,{maxSupportedTransactionVersion:0});
//             const accounts = (tx?.transaction?.message?.instructions).find(ix => ix.programId.toBase58() ===process.env.RAYDIUM_OPENBOOK_AMM).accounts;
            
//             if (!accounts) {
//                 console.log("No accounts found in the transaction.");
//                 return;
//             }

//             const tokenAIndex = 8;
//             const tokenBIndex = 9;

//             const tokenAAccount = accounts[tokenAIndex];
//             const tokenBAccount = accounts[tokenBIndex];
//             const targetToken=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?tokenBAccount.toBase58():tokenAAccount.toBase58();
//             const quoted=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?true:false;
            
//             newPoolMonitorProcesses[targetToken]=true;
//             newPoolMonitorProcesses[targetToken]=fork(newPoolMonitorProcessPath);
//             newPoolMonitorProcesses[targetToken].send({token:targetToken,quoted:quoted});
//             newPoolMonitorProcesses[targetToken].on("message",message=>{
//                 botClients.forEach(async oneClient=>{
//                     // await bot.api.sendPhoto(oneClient,message.image);
//                     bot.api.sendMessage(oneClient,
//                         `<b>⚡️ New Pool ⚡️</b>\n\n<b>Name : </b>${message.name}\n<b>Description : </b>\n${message.description}\n<b>Symbol : </b>${message.symbol}\n\n<b>Liquidity : </b><b>${message.lpValue} SOL</b>\n<b>Market Cap : </b><b>${Number(message.marketCap).toFixed(2)} $</b>\n<b>Largest holdings : </b>\n<b>${message.largestHolders}</b> wallets are owning <b>${Number(message.largestHoldingsPercentage).toFixed(2)} %</b> \n\n<b>Mint : </b>\n\n<code>${targetToken}</code>\n\n<a href="https://solscan.io/token/${targetToken}">Solscan</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.poolId}">Photon</a> | <a href="https://dexscreener.com/solana/${message.poolId}">DexScreener</a>\n`
//                         ,{
//                             parse_mode:"HTML",
//                             link_preview_options:{
//                                 is_disabled:true
//                             },
//                         }
//                     );
//                 })
//             })
//             newPoolMonitorProcesses[targetToken].on("exit",(code)=>{
//                 delete newPoolMonitorProcesses[targetToken];
//             })

//         } catch (error) {
//             console.log(error)
//         }
        
//     }
// })
bot.start()