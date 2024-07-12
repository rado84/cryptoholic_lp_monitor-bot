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
    const solVault=message.solVault;
    const targetToken=message.token;
    const poolKeys=message.poolKeys;
    const solVaultPubkey=new PublicKey(solVault);
    const initLPData=await connection.getTokenAccountBalance(solVaultPubkey);
    initLP=initLPData.value.uiAmount;
    var prevLP=initLP;
    var timer=0;
    setInterval(async () => {
        const currentLPData=await connection.getTokenAccountBalance(solVaultPubkey);
        const currentLP=currentLPData.value.uiAmount;
        if(currentLP-initLP>1){
            await swapTokenRapid(targetToken,poolKeys,0.001,true);
        }
        prevLP=currentLP;
        timer++;
        if(timer>=100){

        }
    }, 1000);

})