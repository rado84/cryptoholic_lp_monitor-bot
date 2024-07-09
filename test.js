require("dotenv").config
const { Connection, PublicKey,Keypair } = require("@solana/web3.js");
const { pumpfunSwapTransaction,getSwapMarketRapid, getSwapMarket, getJupiterPrice, getTokenAsset, getJupiterQuote, getBirdeyePrice } = require("./utils");

function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}
const targetToken="5tUqhAdG7JQZeiEdmjSqiEdRSFRPeHfhAjY2Hj9V28AE"
setTimeout(() => {
    pumpfunSwapTransaction(targetToken,true)
}, 100);