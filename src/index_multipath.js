import dotenv from "dotenv";
import Web3 from "web3";
dotenv.config();

const rpcUrl = process.env.WEB3_RPC_URL || '';
console.log("using rpc", rpcUrl);
const web3 = new Web3(rpcUrl);

// //// generatee lookup tables (ABI <-> signature)
// const routerJson = require('./IUniswapV2Router02.json');
// const abi = routerJson.abi;

// const abis = abi.filter(a => a.type == "function");
// console.log(abis.length)

// // encode signature
// const signatureABILookup = {};
// const ABISignatureLookup = {};
// for (let [idx, funcDesc] of abis.entries()) {
//     console.log("processing ", idx)
//     const pack = { inputs: funcDesc.inputs, name: funcDesc.name, type: funcDesc.type };
//     const funcSig = web3.eth.abi.encodeFunctionSignature(pack);
//     // console.log(funcSig);
//     // signature -> ABI lookup
//     signatureABILookup[funcSig] = funcDesc;
//     // ABI -> signature lookup
//     ABISignatureLookup[funcDesc.name] = funcSig;
// }

// console.log(ABISignatureLookup)

// const arr = [
//     'Mint(address,uint256,uint256)',
//     'Burn(address,uint256,uint256,address)',
//     'Swap(address,uint256,uint256,uint256,uint256,address)',
//     'Sync(uint112,uint112)',
//     'Approval(address,address,uint256)',
//     'Transfer(address,address,uint256)',
//     'flashArbitrageSwapPath(address,uint256,address,address[],uint256[])'
// ];
// for (let e of arr) {
//     console.log(e, web3.eth.abi.encodeEventSignature(e))
// }

// // // get ETH price
// const Web3 = require("web3") // for nodejs only
// const web3 = new Web3("https://rinkeby.infura.io/v3/1e70bbd1ae254ca4a7d583bc92a067a2")
// const aggregatorV3InterfaceABI = [{ "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "description", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint80", "name": "_roundId", "type": "uint80" }], "name": "getRoundData", "outputs": [{ "internalType": "uint80", "name": "roundId", "type": "uint80" }, { "internalType": "int256", "name": "answer", "type": "int256" }, { "internalType": "uint256", "name": "startedAt", "type": "uint256" }, { "internalType": "uint256", "name": "updatedAt", "type": "uint256" }, { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "latestRoundData", "outputs": [{ "internalType": "uint80", "name": "roundId", "type": "uint80" }, { "internalType": "int256", "name": "answer", "type": "int256" }, { "internalType": "uint256", "name": "startedAt", "type": "uint256" }, { "internalType": "uint256", "name": "updatedAt", "type": "uint256" }, { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "version", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }]
// const addr = "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e"   // rinkeby ETH/USD
// const priceFeed = new web3.eth.Contract(aggregatorV3InterfaceABI, addr)
// priceFeed.methods.latestRoundData().call()
//     .then((roundData) => {
//         // Do something with roundData
//         console.log("Latest Round Data", roundData)
//     })

////// start
import { methodHashList, eventHashList, eventList } from "./methodList";
import TokenList from "./TokenList";
import { getCreate2Address } from "@ethersproject/address";
import { pack, keccak256 } from "@ethersproject/solidity";
const getPairAddress = (token0Addr, token1Addr) => {
    const FACTORY_ADDRESS = "0xb43DD1c50377b6dbaEBa3DcBB2232a3964b22440";
    const INIT_CODE_HASH = "0xfbf3b88d6f337be529b00f1dc9bff44bb43fa3c6b5b7d58a2149e59ac5e0c4a8";
    const [_token0, _token1] =
        token0Addr.toLowerCase() < token1Addr.toLowerCase()
            ? [token0Addr, token1Addr]
            : [token1Addr, token0Addr];
    const pairAddress = getCreate2Address(
        FACTORY_ADDRESS,
        keccak256(["bytes"], [pack(["address", "address"], [_token0, _token1])]),
        INIT_CODE_HASH
    );
    return pairAddress;
}

const decodeTokenAmount = (tokenAddr, amount) => {
    const token = TokenList.find(token => token.address == tokenAddr);
    const tokenSymbol = token.symbol;
    const amountFloat = amount / Math.pow(10, token.decimals);
    return { symbol: tokenSymbol, amount: amountFloat }
}

const decodeMultiPath = (logs, from) => {
    const flashSwapLog = logs[logs.length - 1];
    const decodedLog = web3.eth.abi.decodeLog(eventList["flashArbitrageSwapPath"], flashSwapLog.data, flashSwapLog.topics);
    const inToken = decodedLog.inToken;
    const outToken = decodedLog.outToken;
    console.log(decodedLog.allPath);

    const intermediateTokens = decodedLog.allPath.filter((path, idx) => decodedLog.XiArr[idx] > 0 && path != outToken); // remove direct path
    const directPool = getPairAddress(inToken, outToken);
    const pools1 = intermediateTokens.reduce((prev, imToken) => ({ ...prev, [getPairAddress(inToken, imToken)]: imToken }), {});
    const pools2 = intermediateTokens.reduce((prev, imToken) => ({ ...prev, [getPairAddress(outToken, imToken)]: imToken }), {});
    console.log("pools", pools1)


    const allocAs = {};
    const allocBs = {};
    const allocCs = {};
    for (let log of logs) {
        console.log(log.topics)
        const eventName = eventHashList[log.topics[0]];
        if (eventName == "Transfer") {
            const decodedTransfer = web3.eth.abi.decodeLog(eventList["Transfer"], log.data, log.topics.slice(1));
            // check both direct and indirect swap
            if (pools1[decodedTransfer.to] || decodedTransfer.to == directPool) {
                const imToken = pools1[decodedTransfer.to];
                allocAs[imToken] = decodeTokenAmount(inToken, decodedTransfer.value);
            } else if (pools2[decodedTransfer.from] || decodedTransfer.from == directPool) {
                const imToken = pools2[decodedTransfer.from];
                allocCs[imToken] = decodeTokenAmount(outToken, decodedTransfer.value);
            } else if (intermediateTokens.indexOf(log.address) > -1) {
                const imToken = log.address;
                allocBs[imToken] = decodeTokenAmount(imToken, decodedTransfer.value);
            }
        }
    }
    console.log(allocAs, allocBs, allocCs);

}

const decodeTx = tx => {
    const methodSignature = tx.input.slice(0, 10);
    const methodName = methodHashList[methodSignature];
    const { from, to } = tx;
    // [optional] we can add tx.input to the return data
    const decodedTx = { from, to, methodName };
    return decodedTx;
}

const decodeLog = async txHash => {
    // Fetch logs
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    const logs = receipt.logs;

    // decode events
    let decodedLogs = [];
    for (let [idx, log] of logs.entries()) {
        const eventName = eventHashList[log.topics[0]];


        let decoded;
        if (eventName == "flashArbitrageSwapPath") {
            // to intermediate
            decoded = web3.eth.abi.decodeLog(eventList[eventName], log.data, log.topics);
            // to final
        } else {
            decoded = web3.eth.abi.decodeLog(eventList[eventName], log.data, log.topics.slice(1))
        }
        decodedLogs.push({ eventName, address: log.address, ...decoded });
    }
    return decodedLogs;
}

const foo = (txPack) => {
    let { tx, logs } = txPack;
    const transferLogs = logs.filter(log => log.eventName == "Transfer");
    const intermediateLogs = transferLogs.filter((log) => log.to != tx.from);
    // console.log("intermediate tx", intermediateLogs);

    for (let imLog of intermediateLogs) {
        const tokenInfo = decodeTokenAmount(imLog.address, imLog.value);
        console.log("add to pool ", imLog.to, tokenInfo);
    }
}

const main = async () => {
    const addr = '0xb0e4e7af1962ae746a6841aa47296d2c26f1b6da328000c7107d7a256d5cb6af'    // 1 paths
    // const addr = '0x5d611f6a3e00f22989cd1ec43591e491a7e4fff0db4ff926ddcb336268235c47'   // 3 paths
    // const addr = '0xbe0b91de61a85733b1b6e7eb5b57fb4f8bf486ffe2a7467b0762063a11ea0f9f'   // many paths
    // const addr = '0x04ab11ea081416f9535dd7c5339acc4567708fa24de438fca396fc609885c611'   // with direct path
    // const addr = '0xeddcfcd0d35842d3a55b4e5b826fe9db5128cc6bf87908c92d42e136dfb2d236' // add liquidity

    // decode transaction
    const tx = await web3.eth.getTransaction(addr);
    const decodedTx = decodeTx(tx);
    const decodedLogs = await decodeLog(tx.hash);
    const txPack = { tx: decodedTx, logs: decodedLogs };

    foo(txPack);

}

main();


