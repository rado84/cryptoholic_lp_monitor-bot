require("dotenv").config
const { Connection, PublicKey,Keypair } = require("@solana/web3.js");
const { pumpfunSwapTransaction,getSwapMarketRapid, getSwapMarket, getJupiterPrice, getTokenAsset, getJupiterQuote, getBirdeyePrice } = require("./utils");
const { swapTokenTestBuy, swapTokenRapid } = require("./swap");

function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}
const targetToken="AAfqeJ1CBgLfEzobedkQCtYY8LT9vW4yTv9EeZLBpump"

getSwapMarketRapid(targetToken,true)
.then(async swapMarket=>{
    console.log(swapMarket)
    swapTokenRapid(targetToken,swapMarket.poolKeys,0.001,true)
    // await swapTokenTestBuy(targetToken,swapMarket.poolKeys,100000);
})
