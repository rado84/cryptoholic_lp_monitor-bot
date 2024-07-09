require('dotenv').config()
const {Connection,PublicKey}=require('@solana/web3.js')
const fs=require("fs")
const path=require("path")
const connection = new Connection(process.env.RPC_API);
const {  LIQUIDITY_STATE_LAYOUT_V4, Liquidity,MARKET_STATE_LAYOUT_V3,Market,poolKeys2JsonInfo} = require('@raydium-io/raydium-sdk');
const { getBirdeyePrice, getSwapMarketRapid, getTokenAsset, pumpfunSwapTransaction } = require('./utils');
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new PublicKey(SOL_MINT_ADDRESS);


let numberOfTrades=0;
let numberOfBuyTrades=0;
let tokenContent;
let tokenATA;
let prevSOL=0;
let initSOL=0;
let bought=false;
process.on("message",async message=>{
    const targetToken=message.token;
    const tokenPubkey=new PublicKey(targetToken)
    // console.log(message)
    if(message.txType=="create"){
        const bondingCurveKey=message.bondingCurveKey;
        const bondingCurve=new PublicKey(bondingCurveKey);

        const initSOLData=await connection.getBalance(bondingCurve);
        initSOL=initSOLData/(10**9);

        prevSOL=initSOL;
        let timer=0;
        setInterval(() => {
            if(timer>=10&&prevSOL<1){
                process.exit(null);
            }
            timer++;
        }, 5000);
        
    }

    if(message.txType=="buy"||message.txType=="sell"){
        numberOfTrades++;
        if(message.txType=="buy") numberOfBuyTrades++;
        const bondingCurveKey=message.bondingCurveKey;
        const bondingCurve=new PublicKey(bondingCurveKey);
        const currentSOLData=await connection.getBalance(bondingCurve);
        const currentSOL=currentSOLData/(10**9);
        if(currentSOL>10){
            const tokenAssetRes=await fetch(`https://pumpportal.fun/api/data/token-info?ca=${targetToken}`);
            const tokenAsset=await tokenAssetRes.json();
            process.send({bought:true,solAmount:currentSOL,marketCap:message.marketCapSol,name:tokenAsset.data.name,description:tokenAsset.data.description,symbol:tokenAsset.data.symbol,numberOfBuyTrades,numberOfTrades});
            process.exit(0);
        }
        prevSOL=currentSOL;
    }
})