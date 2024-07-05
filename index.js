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

const ws = new WebSocket(process.env.WEBSOCKET_API);

const monitorProcessPath=path.resolve(__dirname,"monitor.js");
const newPoolMonitorProcessPath=path.resolve(__dirname,"newPoolMonitor.js");

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new web3.PublicKey(SOL_MINT_ADDRESS);
const RAYDIUM_OPENBOOK_AMM=new web3.PublicKey(process.env.RAYDIUM_OPENBOOK_AMM);
const raydium_program_id=new web3.PublicKey(process.env.RAYDIUM_OPENBOOK_AMM);

// const client = new Client("http://15.204.241.116:10000/");

if(!fs.existsSync(path.resolve(__dirname,"logs"))){
    fs.mkdirSync(path.resolve(__dirname,"logs"));
}

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

const connection = new web3.Connection(process.env.RPC_API);//Web3.js Connection

const signatures=[];
const monitorProcesses={}
const newPoolMonitorProcesses={};

connection.onLogs(TOKEN_PROGRAM_ID,async ({logs,signature,err})=>{
    if(logs.some(oneLog=>oneLog.includes("burn")||oneLog.includes("Burn")||oneLog.includes("burnChecked"))){
        if(signature=="1111111111111111111111111111111111111111111111111111111111111111") return;
        // console.log(`From Polling : ${signature}`)
        if(signatures.some(sig=>sig==signature)) return;
        signatures.push(signature)
        if(signatures.length>100) signatures.shift();
        // console.log(signature)
        try {
            const tx=await connection.getParsedTransaction(signature,{maxSupportedTransactionVersion:0});
            const instruction= tx?.transaction?.message?.instructions.find(ix => {
                return ix?.parsed?.type=="burn"||ix?.parsed?.type=="Burn"||ix?.parsed?.type=="burnChecked"});
            if(!instruction) return;
            
            const mint=instruction.parsed.info.mint;
            const totalSupply=await connection.getTokenSupply(new web3.PublicKey(mint));
            // console.log(totalSupply.value)
            if(totalSupply.value.uiAmount>0) {
                // console.log("NOT ALL BURNED TOKEN!!!");
                // console.log({amount: totalSupply.value, token:`https://solscan.io/token/${mint}`})
                return;
            }
            if(monitorProcesses[mint]) {
                // console.log("ALREADY MONITORING!!!")
                return;
            }
            monitorProcesses[mint]=true;
            monitorProcesses[mint]=fork(monitorProcessPath);
            monitorProcesses[mint].send({token:mint})
            monitorProcesses[mint].on("message",async message=>{
                if(message.marketCap){
                    botClients.forEach(async oneClient=>{
                        // await bot.api.sendPhoto(oneClient,message.image);
                        bot.api.sendMessage(oneClient,
                            `<b>🔥 Burned Pool 🔥</b>\n\n<b>Name : </b><b>${message.name}</b>\n<b>Description : </b>\n<b>${message.description}</b>\n<b>Symbol : </b><b>${message.symbol}</b>\n\n<b>Liquidity : </b><b>${message.lpValue} SOL</b>\n<b>Market Cap : </b><b>${Number(message.marketCap).toFixed(2)} $</b>\n<b>Largest holdings : </b>\n<b>${message.largestHolders}</b> wallets are owning <b>${message.largestHoldingsPercentage} %</b> \n\n<b>Mint : </b>\n\n<code>${message.token}</code>\n\n<a href="https://solscan.io/token/${mint}">Solscan</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.poolId}">Photon</a> | <a href="https://dexscreener.com/solana/${message.poolId}">DexScreener</a>\n`
                            ,{
                                parse_mode:"HTML",
                                link_preview_options:{
                                    is_disabled:true
                                },
                            }
                        );
                        
                    })
                    
                }
            })
            monitorProcesses[mint].on("exit",(code)=>{
                delete monitorProcesses[mint];
            })
        } catch (error) {
            console.log(error)
        }
        
    }
})
connection.onLogs(raydium_program_id,async ({logs,signature,err})=>{
    // console.log(signature)
    if(logs.some(log=>log.includes("initialize2"))){
        try {
            const tx=await connection.getParsedTransaction(signature,{maxSupportedTransactionVersion:0});
            const accounts = (tx?.transaction.message.instructions).find(ix => ix.programId.toBase58() ===process.env.RAYDIUM_OPENBOOK_AMM).accounts;
            
            if (!accounts) {
                console.log("No accounts found in the transaction.");
                return;
            }

            const tokenAIndex = 8;
            const tokenBIndex = 9;

            const tokenAAccount = accounts[tokenAIndex];
            const tokenBAccount = accounts[tokenBIndex];
            const targetToken=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?tokenBAccount.toBase58():tokenAAccount.toBase58();
            const quoted=(tokenAAccount.toBase58()==SOL_MINT_ADDRESS)?true:false;
            
            newPoolMonitorProcesses[targetToken]=true;
            newPoolMonitorProcesses[targetToken]=fork(newPoolMonitorProcessPath);
            newPoolMonitorProcesses[targetToken].send({token:targetToken,quoted:quoted});
            newPoolMonitorProcesses[targetToken].on("message",message=>{
                botClients.forEach(async oneClient=>{
                    // await bot.api.sendPhoto(oneClient,message.image);
                    bot.api.sendMessage(oneClient,
                        `<b>⚡️ New Pool ⚡️</b>\n\n<b>Name : </b>${message.name}\n<b>Description : </b>\n${message.description}\n<b>Symbol : </b>${message.symbol}\n\n<b>Liquidity : </b><b>${message.lpValue} SOL</b>\n<b>Market Cap : </b><b>${Number(message.marketCap).toFixed(2)} $</b>\n<b>Largest holdings : </b>\n<b>${message.largestHolders}</b> wallets are owning <b>${Number(message.largestHoldingsPercentage).toFixed(2)} %</b> \n\n<b>Mint : </b>\n\n<code>${targetToken}</code>\n\n<a href="https://solscan.io/token/${targetToken}">Solscan</a> | <a href="https://photon-sol.tinyastro.io/en/lp/${message.poolId}">Photon</a> | <a href="https://dexscreener.com/solana/${message.poolId}">DexScreener</a>\n`
                        ,{
                            parse_mode:"HTML",
                            link_preview_options:{
                                is_disabled:true
                            },
                        }
                    );
                })
            })
            newPoolMonitorProcesses[targetToken].on("exit",(code)=>{
                delete newPoolMonitorProcesses[targetToken];
            })

        } catch (error) {
            console.log(error)
        }
        
    }
})
bot.start()