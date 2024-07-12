require("dotenv").config
const { Connection, PublicKey,Keypair } = require("@solana/web3.js");
const { pumpfunSwapTransaction,getSwapMarketRapid, getSwapMarket, getJupiterPrice, getTokenAsset, getJupiterQuote, getBirdeyePrice } = require("./utils");
const { swapTokenTestBuy, swapTokenRapid } = require("./swap");

function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}
const targetToken="PmS25n2WQp6EfVWuziwhaS388mX4U1KYtfNM5qF2NpK"

getSwapMarketRapid(targetToken,false)
.then(async swapMarket=>{
    console.log(swapMarket)
    // swapTokenRapid(targetToken,swapMarket.poolKeys,0.001,true)
    await swapTokenTestBuy(targetToken,swapMarket.poolKeys,100000);
})
