require('dotenv').config()
const {Connection,PublicKey}=require('@solana/web3.js')
const fs=require("fs")
const path=require("path")
const connection = new Connection(process.env.RPC_API);
const {  LIQUIDITY_STATE_LAYOUT_V4, Liquidity,MARKET_STATE_LAYOUT_V3,Market,poolKeys2JsonInfo} = require('@raydium-io/raydium-sdk');
const { getBirdeyePrice, getTokenAsset } = require('./utils');
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_MINT_PUBKEY=new PublicKey(SOL_MINT_ADDRESS);
process.on("message",async message=>{

    const mint=message.token;
    console.log({mint})
    const raydium_program_id=new PublicKey(process.env.RAYDIUM_OPENBOOK_AMM);
    var accounts=await connection.getProgramAccounts(
        raydium_program_id,
        {
          commitment: 'confirmed',
          filters: [
            { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
            {
              memcmp: {
                offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('lpMint'),
                bytes: mint,
              },
            },
          ],
        },
    );
    if(!accounts) process.exit(null)
    if(!accounts[0]) process.exit(null);
    
    const poolInfo=LIQUIDITY_STATE_LAYOUT_V4.decode(accounts[0].account.data);
    const poolId=accounts[0].pubkey.toBase58();
    // if((poolInfo.baseMint!=SOL_MINT_PUBKEY)&&(poolInfo.quoteMint!=SOL_MINT_PUBKEY)) process.exit(null);
    console.log(poolInfo)
    console.log(`https://dexscreener.com/solana/${accounts[0].pubkey.toBase58()}`);
    const targetToken=((poolInfo.baseMint.toString()==SOL_MINT_ADDRESS)?poolInfo.quoteMint.toString():poolInfo.baseMint.toString());
    const solVault=((poolInfo.baseMint.toString()==SOL_MINT_ADDRESS)?poolInfo.baseVault:poolInfo.quoteVault);
    const tokenPubkey=new PublicKey(targetToken);
    const tokenAccountInfo=await connection.getParsedAccountInfo(tokenPubkey);
    const tokenInfo=tokenAccountInfo.value.data.parsed;
    if(tokenInfo.info.freezeAuthority) {
      console.log("FROZEN!!!");
      // fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`FROZEN!!!\n`);
      process.exit(null);
    }
    if(tokenInfo.info.mintAuthority) {
        console.log("NOT RENOUNCED!!!");
        // fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`NOT RENOUNCED!!!\n`);
        process.exit(null);
    }

    var totalSupply;
    var largestHolders;
    var largestHoldingsPercentage=0
    const distribution=[];
    try {
        totalSupply=await connection.getTokenSupply(tokenPubkey)
        largestHolders=await connection.getTokenLargestAccounts(tokenPubkey);
        var largestHoldings=0;
        for(var i=0;i<largestHolders.value.length;i++){
            const oneLargetHoldingPercent=largestHolders.value[i].uiAmount*100/totalSupply.value.uiAmount
            largestHoldings+=oneLargetHoldingPercent;
            distribution.push(`${oneLargetHoldingPercent.toFixed(2)}%`);
        }
        largestHoldingsPercentage=largestHoldings;
        
        console.log(`The largest ${largestHolders.value.length} holders are owning ${largestHoldingsPercentage.toFixed(2)}% of total supply.`)
        if(largestHoldingsPercentage>50) {
          console.log("The largest holders owned too large amount");
        }
    } catch (error) {
        console.log(error);
        // process.exit();
    }
    

    const priceData=await getBirdeyePrice(targetToken);
    if(!priceData) process.exit(null);
    if(!priceData.data) process.exit(null);
    const marketCap=Number(priceData.data.value)*totalSupply.value.uiAmount;
    if(marketCap<40000) {
      console.log("TOO SMALL MARKET CAP!!!");
      // process.exit(null);
    }

    const solAmount=await connection.getTokenAccountBalance(solVault);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),"Burned Pool\n");
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`https://dexscreener.com/solana/${accounts[0].pubkey.toBase58()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`BASE MINT : ${poolInfo.baseMint.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`BASE VAULT : ${poolInfo.baseVault.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`QUOTE MINT : ${poolInfo.quoteMint.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`QUOTE MINT : ${poolInfo.quoteVault.toString()}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`INITIAL MARKET CAP : ${marketCap}\n`);
    fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`INITIAL LIQUIDITY : ${solAmount.value.uiAmount}\n`);
    const tokenAsset=await getTokenAsset(targetToken);
    console.log(tokenAsset)
    const tokenContent=tokenAsset.result.content.metadata;
    process.send({
      name:tokenContent.name,
      symbol:tokenContent.symbol,
      description:tokenContent.description,
      lpValue:solAmount.value.uiAmount,
      marketCap,poolId:poolId,
      token:targetToken,
      image:tokenAsset.result.content.files.cdn_uri,
      largestHolders:largestHolders.value.length,
      largestHoldingsPercentage
    })
    var timer=0;
    var intervalId=setInterval(async () => {
      const solAmount=await connection.getTokenAccountBalance(solVault);
      fs.appendFileSync(path.resolve(__dirname,"logs",targetToken),`LP Value : ${solAmount.value.uiAmount}\n`);
      if(timer>3600) {
        process.exit(null)
      }
      timer++
    }, 1000);
    // process.exit(0)
})