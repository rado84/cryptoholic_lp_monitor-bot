require("dotenv").config
const { Connection, PublicKey,Keypair } = require("@solana/web3.js");
const { pumpfunSwapTransaction,getSwapMarketRapid, getSwapMarket, getJupiterPrice, getTokenAsset, getJupiterQuote, getBirdeyePrice } = require("./utils");
const { swapTokenTestBuy, swapTokenRapid } = require("./swap");

function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}
const targetToken="29Ue9AVrjbF6yP6taQ46y8DxwVrUoPD7RWgxNgnfpump"
const connection=new Connection(process.env.RPC_API)
// getSwapMarket(targetToken)
// .then(async swapMarket=>{
//     console.log(swapMarket)
//     swapTokenRapid(targetToken,swapMarket.poolKeys,0.001,true)
//     // await swapTokenTestBuy(targetToken,swapMarket.poolKeys,100000);
// })

setTimeout(async() => {
  // pumpfunSwapTransaction(targetToken,0.0001,true)
  const largest=await connection.getTokenLargestAccounts(new PublicKey(targetToken),"confirmed")
  console.log(largest.value)
}, 1000);
