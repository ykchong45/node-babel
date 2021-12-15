// import dotenv from "dotenv";
// import Web3 from "web3";
// dotenv.config();

// const rpcUrl = process.env.WEB3_RPC_URL || '';
// console.log("using rpc", rpcUrl);
// const web3 = new Web3(rpcUrl);

import axios from "axios";
import fs from "fs";

async function getTokenList() {
    let tokenList;
    axios.get("https://api.coingecko.com/api/v3/coins/list?include_platform=true").then(res => {
        console.log(res);
        tokenList = JSON.stringify(res.data, null, 2);
        fs.writeFile("tokenList.json", tokenList, err => {
            if (err) throw err;
            console.log("Data written to file");
        });
    })
}

async function getTokenPrices() {
    let priceList = [];
    axios.get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd").then(res => {
        const pricesData = res.data;
        priceList = pricesData.map(p => ({id: p.id, symbol: p.symbol, current_price: p.current_price, last_updated: p.last_updated}));
        console.log(priceList.slice(0,5));

    });
}

//////

function createTask(callback, timeout) {
    const taskFunc = async () => {
        callback();
        setTimeout(taskFunc, timeout);
    }
    return taskFunc;
}

const main = async () => {
    // const getTokenPricesCaller = createTask(getTokenPrices, 60000);
    // getTokenPricesCaller();
    getTokenList();
}

main();


