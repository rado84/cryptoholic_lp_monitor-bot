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
const { TOKEN_PROGRAM_ID, AccountLayout, getAssociatedTokenAddressSync } = require('@solana/spl-token');
const {  LIQUIDITY_STATE_LAYOUT_V4, Liquidity,MARKET_STATE_LAYOUT_V3,Market,poolKeys2JsonInfo, ApiPoolInfoV4, SPL_MINT_LAYOUT} = require('@raydium-io/raydium-sdk');
const WebSocket = require('ws');
const Client=require("@triton-one/yellowstone-grpc");
const { pumpfunSwapTransaction, getSwapMarketRapid } = require('./utils');
const bs58=require("bs58");
const { swapTokenTestBuy, swapTokenRapid } = require('./swap');

const client =new Client.default("http://169.197.88.102:10005/", "");

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

const monitorProcessPath=path.resolve(__dirname,"monitor.js");
const newPoolMonitorProcessPath=path.resolve(__dirname,"newPoolMonitor.js");
const pumpfunMonitorPath=path.resolve(__dirname,"pumpfunMonitor.js")
const geyserMonitorPath=path.resolve(__dirname,"geyserMonitor.js");

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new web3.PublicKey(SOL_MINT_ADDRESS);
const RAYDIUM_OPENBOOK_AMM=new web3.PublicKey(process.env.RAYDIUM_OPENBOOK_AMM);
const raydium_program_id=new web3.PublicKey(process.env.RAYDIUM_OPENBOOK_AMM);

const PUMPFUN_MARKET_CAP=70;//SOL
const NUMBER_OF_BUY_TRADES=25//Number
const NUMBER_OF_TRADES=30;



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
    const stream =await client.subscribe();
    stream.on("data", async (data) => {
        
        // console.log(`https://solscan.io/tx/${sig}`)
        // return;
        if(data.transaction&&data.transaction.transaction&&data.transaction.transaction.signature) {
            const sig=bs58.encode(data.transaction.transaction.signature)
            const transaction=data.transaction.transaction;
            if(transaction.meta.logMessages.some(log=>log.includes("initialize2"))){
                var raydiumPoolProgramIndex=0;
                const allAccounts=[];
                transaction.transaction.message.accountKeys.map((account,index)=>{
                    if(!account) return;
                    const accountID=bs58.encode(account);
                    allAccounts.push(accountID);
                    if(accountID==process.env.RAYDIUM_OPENBOOK_AMM){
                        raydiumPoolProgramIndex=index;
                    }
                })
                const swapInstruction = (transaction?.transaction.message.instructions).find(instruction =>instruction.programIdIndex==raydiumPoolProgramIndex);
                if(!swapInstruction){
                    console.log("NO_SWAP_INSTRUCTION");
                    return;
                }
                const accounts=swapInstruction.accounts;
                if (!accounts) {
                    console.log("No accounts found in the transaction.");
                    return;
                }
                const tokenAIndex = 8;
                const tokenBIndex = 9;
                const marketKeyIndex = 16;
                if(!transaction.transaction.message.accountKeys[accounts[tokenAIndex]]) return;
                if(!transaction.transaction.message.accountKeys[accounts[tokenBIndex]]) return;
                if(!transaction.transaction.message.accountKeys[accounts[marketKeyIndex]]) return;
                const tokenAAccount = bs58.encode(transaction.transaction.message.accountKeys[accounts[tokenAIndex]]);
                const tokenBAccount = bs58.encode(transaction.transaction.message.accountKeys[accounts[tokenBIndex]]);
                const marketAccountKey= bs58.encode(transaction.transaction.message.accountKeys[accounts[marketKeyIndex]]);

                var [baseMintAccount, quoteMintAccount, marketAccount] = await connection.getMultipleAccountsInfo([
                    new web3.PublicKey(tokenAAccount),
                    new web3.PublicKey(tokenBAccount),
                    new web3.PublicKey(marketAccountKey),
                ],"processed");
                if(!baseMintAccount){
                    sleep(50);
                    baseMintAccount=await connection.getAccountInfo(new web3.PublicKey(tokenAAccount));
                }
                if(!quoteMintAccount){
                    sleep(50);
                    quoteMintAccount=await connection.getAccountInfo(new web3.PublicKey(tokenBAccount));
                }
                if(!marketAccount){
                    sleep(50)
                    marketAccount=await connection.getAccountInfo(new web3.PublicKey(marketAccountKey));
                }
                if(!marketAccount){
                    sleep(50)
                    marketAccount=await connection.getAccountInfo(new web3.PublicKey(marketAccountKey));
                }
                if(!marketAccount){
                    console.log("FAILED_TO_GET_MARKET");
                    return;
                }
                const baseMintInfo = SPL_MINT_LAYOUT.decode(baseMintAccount.data)
                const quoteMintInfo = SPL_MINT_LAYOUT.decode(quoteMintAccount.data)
                const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)

                const poolInfos={
                    id: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[4]])),
                    baseMint: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[8]])),
                    quoteMint: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[9]])),
                    lpMint: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[7]])),
                    baseDecimals: baseMintInfo.decimals,
                    quoteDecimals: quoteMintInfo.decimals,
                    lpDecimals: baseMintInfo.decimals,
                    version: 4,
                    programId: new web3.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
                    authority: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[5]])),
                    openOrders: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[6]])),
                    targetOrders: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[12]])),
                    baseVault: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[10]])),
                    quoteVault: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[11]])),
                    withdrawQueue: web3.PublicKey.default,
                    lpVault: web3.PublicKey.default,
                    marketVersion: 3,
                    marketProgramId: marketAccount.owner,
                    marketId: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[16]])),
                    marketAuthority: Market.getAssociatedAuthority({ programId: marketAccount.owner, marketId: new web3.PublicKey(bs58.encode(transaction.transaction.message.accountKeys[accounts[16]])) }).publicKey,
                    marketBaseVault: marketInfo.baseVault,
                    marketQuoteVault: marketInfo.quoteVault,
                    marketBids: marketInfo.bids,
                    marketAsks: marketInfo.asks,
                    marketEventQueue: marketInfo.eventQueue,
                };
                // console.log(poolInfos)           
                
                const targetToken=(tokenAAccount==SOL_MINT_ADDRESS)?tokenBAccount:tokenAAccount;
                if(targetToken.endsWith("pump")){
                    console.log("FROM_PUMPFUN");
                    return;
                }
                const quoted=(tokenAAccount==SOL_MINT_ADDRESS)?true:false;
                const tokenInfoData=await connection.getParsedAccountInfo(new web3.PublicKey(targetToken),"processed");
                const tokenInfo=tokenInfoData.value.data.parsed.info;
                console.log({targetToken,quoted})
                console.log(`https://solscan.io/tx/${sig}`)
                if(tokenInfo.freezeAuthority) {
                    console.log("FROZEN From GEYSER!!!")
                    return;
                }
                if(tokenInfo.mintAuthority) {
                    console.log("NOT RENOUNCED FROM GEYSER!!!")
                    return;
                }
                // await swapTokenTestBuy(targetToken,poolInfos,1000000);
                
                console.log(tokenInfo)
                const solVault=(poolInfos.baseMint.toString()==SOL_MINT_ADDRESS)?poolInfos.baseVault:poolInfos.quoteVault;
                var solAmount=0;
                try {
                    const solAmountData=await connection.getTokenAccountBalance(solVault,"processed");
                    solAmount=solAmountData.value.uiAmount;
                } catch (error) {
                    console.log(error)
                    sleep(50)
                    try {
                        const solAmountData=await connection.getTokenAccountBalance(solVault,"processed");
                        solAmount=solAmountData.value.uiAmount;
                    } catch (error) {
                        console.log(error)
                        sleep(50)
                        try {
                            const solAmountData=await connection.getTokenAccountBalance(solVault,"processed");
                            solAmount=solAmountData.value.uiAmount;
                        } catch (error) {
                            
                        }
                    }
                    
                }
                console.log({solAmount})
                if(solAmount<=30) {
                    console.log("TO SMALL LP")
                    return;
                }
                if(solAmount>600) {
                    console.log("TOO BIG LP!!!")
                    return;
                }
                swapTokenRapid(targetToken,poolInfos,0.001,false);
                var geyserMonitorProcess=fork(geyserMonitorPath);
                geyserMonitorProcess.send({token:targetToken,quoted:quoted,poolKeys:poolInfos,initLP:solAmount});
                geyserMonitorProcess.on("exit",()=>{
                    console.log("EXITED")
                })
                botClients.forEach(oneClient=>{
                    bot.api.sendMessage(oneClient,
                    `<b>💥 New Pool from GEYSER 💥</b>\n\n<b>Mint : </b>\n<code>${targetToken}</code>\n\n<b>LP Value : </b><b>${solAmount}</b> SOL \n\n<a href="https://solscan.io/tx/${sig}" >LP</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${poolInfos.id.toString()}">Photon</a> | <a href="https://dexscreener.com/solana/${poolInfos.id.toString()}" >DexScreener</a> \n`,
                    {parse_mode:"HTML",link_preview_options:{is_disabled:true}})
                })
            }
            if(transaction.meta.logMessages.some(log=>log.includes("InitializeMint2"))){
                // console.log("-------------Pum.fun Mint---------------");
                // transaction.transaction.message.accountKeys.map((account,index)=>{
                //     if(!account) return;
                //     const accountID=bs58.encode(account);
                //     console.log(accountID)
                //     if(accountID==process.env.RAYDIUM_OPENBOOK_AMM){
                //         raydiumPoolProgramIndex=index;
                //     }
                // })
                // console.log(transaction?.transaction.message.instructions)
                // console.log(`https://solscan.io/tx/${sig}`)
                // console.log("----------------------------");
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
                accountInclude: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"],
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

const pumpfunProcesses={};
const pumpfunTokens={}
const ws = new WebSocket(process.env.PUMPFUN_API);

ws.on('open', function open() {

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
            keys: [message.mint]
        }
        ws.send(JSON.stringify(payload))

        // console.log(message)
        const currentTime=new Date();
        const now=currentTime.getTime();
        pumpfunTokens[message.mint]={
            ...message,
            created:now,
            initMarketCapSol:message.marketCapSol,
            numberOfBuyTrades:0,
            numberOfTrades:0
        }
        console.log({monitoringPumpfunTokens:Object.keys(pumpfunTokens).length})
    }else{
        // console.log(message)
        if(!message.txType) return;
        if(!pumpfunTokens[message.mint]) return;
        pumpfunTokens[message.mint].numberOfTrades=pumpfunTokens[message.mint].numberOfTrades+1;
        if(message.txType=="buy") pumpfunTokens[message.mint].numberOfBuyTrades=pumpfunTokens[message.mint].numberOfBuyTrades+1;
        // pumpfunTokens[message.mint].initMarketCapSol=pumpfunTokens[message.mint].marketCapSol;
        pumpfunTokens[message.mint].marketCapSol=message.marketCapSol;
        if(message.marketCapSol>PUMPFUN_MARKET_CAP){
            if(pumpfunTokens[message.mint].numberOfBuyTrades<NUMBER_OF_BUY_TRADES){
                console.log("NOT ENOUGH BUY TRADES!!!");
                return;
            }
            if((pumpfunTokens[message.mint].numberOfTrades-pumpfunTokens[message.mint].numberOfBuyTrades)<3){
                console.log("NOT ENOUGH SELL TRADES!!!");
                return;
            }
            if(!pumpfunTokens[message.mint]) return;
            // console.log(pumpfunTokens[message.mint])
            const creatorATA=await getAssociatedTokenAddressSync(new web3.PublicKey(message.mint),new web3.PublicKey(pumpfunTokens[message.mint].traderPublicKey));
            var creatorAmount=0
            try {
                const creatorAmountData=await connection.getTokenAccountBalance(creatorATA,"processed");
                creatorAmount=creatorAmountData.value.uiAmount;
            } catch (error) {
                
            }
            var tokenSupplyData=await connection.getTokenSupply(new web3.PublicKey(message.mint),"processed");
            var tokenSupply=tokenSupplyData?.value?.uiAmount;
            var tokenSupplyTimer=0;
            if(!tokenSupply){
                console.log("FAILED TO GET TOKEN SUPPLY!!!")
                return;
            }
            const createOwnedPercentage=(creatorAmount/tokenSupply)*100;
            // const largestHoldersData=await connection.getTokenLargestAccounts(new web3.PublicKey(message.mint),"processed");
            // const largestHolders=largestHoldersData.value;
            // const largestHoldersCount=largestHolders.length;
            if(!pumpfunTokens[message.mint]) {
                console.log("NO MONITOR!!!")
                return;
            }
            const createAt=pumpfunTokens[message.mint].created;
            const currentTime=new Date();
            const now=currentTime.getTime()
            const timeDiff=now-createAt;
            const timeDiffMins=Math.floor(timeDiff/60000);
            if((createOwnedPercentage<8))
                pumpfunSwapTransaction(message.mint,0.0001,true)
                botClients.forEach(async oneClient=>{
                    bot.api.sendMessage(oneClient,
                        `<b>💊 Pump.fun!!! 💊</b>\n\n\n\n<b>Mint : </b>\n\n<code>${message.mint}</code>\n\n<b>Market Cap : </b>${message.marketCapSol} SOL\n<b>Dev Owned : </b>${createOwnedPercentage} %\n<b>Number of Buy Trades : </b>${pumpfunTokens[message.mint].numberOfBuyTrades} \n<b>Number of Sell Trades : </b>${pumpfunTokens[message.mint].numberOfTrades-pumpfunTokens[message.mint].numberOfBuyTrades}\n<b>Created at : </b>${timeDiffMins} mins ago\n\n<a href="https://solscan.io/token/${message.mint}">Solscan</a> | <a href="https://solscan.io/token/${message.bondingCurveKey}">BondingCurve</a> | <a href="https://pump.fun/${message.mint}">Pump.fun</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.bondingCurveKey}">Photon</a> \n`
                        ,{
                            parse_mode:"HTML",
                            link_preview_options:{
                                is_disabled:true
                            },
                        }
                    );
                })
            payload={
                method: "unsubscribeTokenTrade",
                keys: [message.mint] 
            }
            ws.send(JSON.stringify(payload))
            delete pumpfunTokens[message.mint];
            console.log({monitoringPumpfunTokens:Object.keys(pumpfunTokens).length})
        }
    }
});
setInterval(() => {
    for(var token of Object.keys(pumpfunTokens)){
        const currentTime=new Date();
        const now=currentTime.getTime()
        const created=pumpfunTokens[token].created;
        if((now-created)>(30*60000)){
            delete pumpfunTokens[token]
        }
    }
}, 10*60000);
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