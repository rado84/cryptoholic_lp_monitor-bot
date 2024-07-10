require('dotenv').config()
const {Connection,PublicKey}=require('@solana/web3.js')
const fs=require("fs")
const path=require("path")
const connection = new Connection(process.env.RPC_API);
const {  LIQUIDITY_STATE_LAYOUT_V4, Liquidity,MARKET_STATE_LAYOUT_V3,Market,poolKeys2JsonInfo} = require('@raydium-io/raydium-sdk');
const { getBirdeyePrice, getSwapMarketRapid, getTokenAsset } = require('./utils');
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new PublicKey(SOL_MINT_ADDRESS);
process.on("message",async (message)=>{
    const targetToken=message.token;
    const quoted=message.quoted;
    console.log({targetToken,quoted});
    const tokenPubkey=new PublicKey(targetToken)
    var accountInfo;
    accountInfo=await connection.getParsedAccountInfo(tokenPubkey);
    const tokenInfo=accountInfo.value.data.parsed;
    if(tokenInfo.info.freezeAuthority) {
        console.log("FROZEN!!!");
        process.exit(null);
    }
    if(tokenInfo.info.mintAuthority) {
        console.log("NOT RENOUNCED!!!");
        process.exit(null);
    }
    if(fs.existsSync(path.resolve(__dirname,"logs",targetToken))){
        console.log("ALREADY MONITORED!!!")
        process.exit(null)
    }
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),"");
    var totalSupply;
    var largestHolders;
    var largestHoldingsPercentage=0
    const distribution=[];
    try {
        totalSupply=await connection.getTokenSupply(tokenPubkey)
        largestHolders=await connection.getTokenLargestAccounts(tokenPubkey);
        var largestHoldings=0;
        for(var i=0;i<(largestHolders.value.length>=10?10:largestHolders.value.length);i++){
            const oneLargetHoldingPercent=largestHolders.value[i].uiAmount*100/totalSupply.value.uiAmount
            largestHoldings+=oneLargetHoldingPercent;
            distribution.push(`${oneLargetHoldingPercent.toFixed(2)}%`);
        }
        largestHoldingsPercentage=largestHoldings;
        
        console.log(`The largest ${largestHolders.value.length} holders are owning ${largestHoldingsPercentage.toFixed(2)}% of total supply.`)
    } catch (error) {
        console.log(error);
        // process.exit();
    }
    const tokenAsset=await getTokenAsset(targetToken);
    const tokenContent=tokenAsset.result.content.metadata;
    const swapmarket=await getSwapMarketRapid(targetToken,quoted);
    if(!swapmarket) {
        console.log("NO AMM POOL!!!")
        process.exit(null);
    }
    const solVault=(swapmarket.poolInfo.baseMint.toString()==SOL_MINT_ADDRESS)?swapmarket.poolInfo.baseVault:swapmarket.poolInfo.quoteVault;
    const solAmountData=await connection.getTokenAccountBalance(solVault);
    const solAmount=solAmountData.value.uiAmount;
    const priceData=await getBirdeyePrice(targetToken);
    
    var price=0;
    if(priceData&&priceData.data) price=Number(priceData.data.value);
    const marketCap=price*(totalSupply.value.uiAmount);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),"New Pool\n");
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`https://dexscreener.com/solana/${swapmarket.poolKeys.id.toBase58()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`BASE MINT : ${swapmarket.poolInfo.baseMint.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`BASE VAULT : ${swapmarket.poolInfo.baseVault.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`QUOTE MINT : ${swapmarket.poolInfo.quoteMint.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`QUOTE MINT : ${swapmarket.poolInfo.quoteVault.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`INITIAL MARKET CAP : ${marketCap} $\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`INITIAL LIQUIDITY : ${solAmount} SOL\n`);
    process.send({
        name:tokenContent.name,
        symbol:tokenContent.symbol,
        description:tokenContent.description,
        marketCap,
        lpValue:solAmount,
        image:tokenAsset.result.content.files.cdn_uri,
        poolId:swapmarket.poolKeys.id.toString(),
        largestHolders:(largestHolders.value.length>=10?10:largestHolders.value.length),
        largestHoldingsPercentage,
        lpMint:swapmarket.poolInfo.lpMint.toString()
    })
    var timer=0;
    setInterval(async () => {
        const solAmount=await connection.getTokenAccountBalance(solVault);
        fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`LP Value : ${solAmount.value.uiAmount} SOL\n`);
        if(timer>3600) {
            process.exit(0)
        }
        timer++;
    }, 1000);
    
})