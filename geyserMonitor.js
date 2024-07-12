require('dotenv').config()
const {Connection,PublicKey}=require('@solana/web3.js')
const fs=require("fs")
const path=require("path")
const connection = new Connection(process.env.RPC_API);
const {  LIQUIDITY_STATE_LAYOUT_V4, Liquidity,MARKET_STATE_LAYOUT_V3,Market,poolKeys2JsonInfo} = require('@raydium-io/raydium-sdk');
const { getBirdeyePrice, getSwapMarketRapid, getTokenAsset } = require('./utils');
const { swapTokenRapid } = require('./swap');
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new PublicKey(SOL_MINT_ADDRESS);

let initLP=0;
let prevLP=0;
process.on("message",async message=>{
    const targetToken=message.token;
    const quoted=message.quoted;
    const poolKeys=message.poolKeys;
    initLP=message.initLP;
    const solVaultPubkey=new PublicKey((poolKeys.baseMint==SOL_MINT_ADDRESS)?poolKeys.baseVault:poolKeys.quoteVault);
    console.log(targetToken,quoted,poolKeys,solVaultPubkey)
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),"");
    if(initLP==0){
        const initLPData=await connection.getTokenAccountBalance(solVaultPubkey,"processed");
        initLP=initLPData.value.uiAmount;
    }
    
    prevLP=initLP;
    var timer=0;
    setInterval(async () => {
        const currentLPData=await connection.getTokenAccountBalance(solVaultPubkey,"processed");
        const currentLP=currentLPData.value.uiAmount;
        fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`${currentLP}`);
        const diff=currentLP-initLP;
        const diffPercent=(diff/initLP)*100;
        const diffPercentStr=diffPercent.toFixed(2);
        fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),` ( ${diffPercentStr} %)\n`);
        console.log(`${targetToken} ${diffPercentStr} %`)
        if((currentLP-initLP)>2){
            await swapTokenRapid(targetToken,poolKeys,0.001,true);
            process.exit(0);
        }
        if((currentLP-initLP)<=(-5)){
            await swapTokenRapid(targetToken,poolKeys,0.001,true);
            process.exit(0);
        }
        prevLP=currentLP;
        timer++;
        if(timer>=20){
            await swapTokenRapid(targetToken,poolKeys,0.001,true);
            process.exit(0);
        }
    }, 1000);
    

})