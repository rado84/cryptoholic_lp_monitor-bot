require('dotenv').config()
const {Connection,PublicKey,Keypair}=require('@solana/web3.js')
const fs=require("fs")
const path=require("path")
const connection = new Connection(process.env.RPC_API);
const {  LIQUIDITY_STATE_LAYOUT_V4, Liquidity,MARKET_STATE_LAYOUT_V3,Market,poolKeys2JsonInfo} = require('@raydium-io/raydium-sdk');
const { getBirdeyePrice, getSwapMarketRapid, getTokenAsset } = require('./utils');
const { swapTokenRapid } = require('./swap');
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new PublicKey(SOL_MINT_ADDRESS);

const PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY));

const wallet = Keypair.fromSecretKey(PRIVATE_KEY);

let initLP=0;
let prevLP=0;
function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}
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
    const tokenAccount=await getAssociatedTokenAddressSync(new PublicKey(targetToken),wallet.publicKey);
    let myAmount;
    let myAmountTimer=0;
    while(!myAmount){
        sleep(100)
        try {
            const tokenAmountData=await connection.getTokenAccountBalance(tokenAccount);
            myAmount=tokenAmountData.value.uiAmount
        } catch (error) {
            
        }
        myAmountTimer++;
        if(myAmountTimer>=300){
            break;
        }
    };
    if(!myAmount){
        await swapTokenRapid(targetToken,poolKeys,0.001,true)
        process.exit(0);
    }
    console.log({myAmount})
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
        if(((currentLP-initLP)<=(-5))){
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