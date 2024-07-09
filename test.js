require("dotenv").config
const { Connection, PublicKey,Keypair } = require("@solana/web3.js");
const { pumpfunSwapTransaction,getSwapMarketRapid, getSwapMarket, getJupiterPrice, getTokenAsset, getJupiterQuote, getBirdeyePrice } = require("./utils");

function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}
const targetToken="C9LJJr6jSsgc69fG88ee9ZzTc3xqZbGZomUrJ81NTeo9"
setTimeout(() => {
    pumpfunSwapTransaction(targetToken,true)
}, 100);