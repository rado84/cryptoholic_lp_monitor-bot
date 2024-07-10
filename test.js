require("dotenv").config
const { Connection, PublicKey,Keypair } = require("@solana/web3.js");
const { pumpfunSwapTransaction,getSwapMarketRapid, getSwapMarket, getJupiterPrice, getTokenAsset, getJupiterQuote, getBirdeyePrice } = require("./utils");
const { swapTokenTestBuy, swapTokenRapid } = require("./swap");

function sleep(ms) {
    return new Promise((res) => {
      setTimeout(res, ms);
    });
}
// const targetToken="CyYebUmcQyQvXQqXWn4aDAcnLLhhGgfL13dqE3YATgep"

// getSwapMarket(targetToken)
// .then(swapMarket=>{
//     // console.log(swapMarket)
//     swapTokenRapid(targetToken,swapMarket.poolKeys,0.001,true)
//     // swapTokenTestBuy(targetToken,swapMarket.poolKeys,100000);
// })
const my=Buffer.from([11,12])
console.log(my[0],my[1])
