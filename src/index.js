import dotenv from "dotenv";
import Web3 from "web3";
import { abi as routerAbi } from "./IUniswapV2Router02.json";
import tokenAbi from "./ERC20.json";

import TokenList from "./TokenList";
import fs from "fs";
dotenv.config();

const rpcUrl = process.env.WEB3_RPC_URL || '';
console.log("using rpc", rpcUrl);
const web3 = new Web3(rpcUrl);


//////

import theGraphDriver from "./thegraph/server";

////////////

//////
import { getCreate2Address } from "@ethersproject/address";
import { pack, keccak256 } from "@ethersproject/solidity";
import BSCtokenList from "./BSCtokenList";
export const getPairAddress = (token0Addr, token1Addr) => {
    // // eth hashes
    // const FACTORY_ADDRESS = "0xb43DD1c50377b6dbaEBa3DcBB2232a3964b22440";
    // const INIT_CODE_HASH = "0xfbf3b88d6f337be529b00f1dc9bff44bb43fa3c6b5b7d58a2149e59ac5e0c4a8";

    // bsc hashes
    const FACTORY_ADDRESS = "0x89D20aB13D093Eecea6C5af0a22566d4e780892A";
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
///// params

// // eth acy router
// const privateKey = "c4068ac9e796baaf5129508ec8550cfeaabb79959002969f68e11f01b9c1aca9";
// const acyRouterAddr = "0x9c040CC3CE4B2C135452370Eed152A72ce5d5b18";   // eth constract addr

// bsc router
const privateKey = "c4068ac9e796baaf5129508ec8550cfeaabb79959002969f68e11f01b9c1aca9";
const acyRouterAddr = "0x3c841A0298247C50b195e17af6Ab72B2e4cff5E1";   // bsc constract addr
const maxAmount = web3.utils.toBN(2 ** 64 - 1).toString() + "0".repeat(18);
let maxGas = 10000500;

const acc = web3.eth.accounts.privateKeyToAccount("0x" + privateKey);
const routerContract = new web3.eth.Contract(routerAbi, acyRouterAddr);
let txCount;
let adjustedGasPrice;

class PoolCreater {

    constructor(_token0, _token1, _amount0, _amount1, idx) {

        this.token0Addr = web3.utils.toChecksumAddress(_token0);
        this.token1Addr = web3.utils.toChecksumAddress(_token1);
        this.poolAddr = getPairAddress(this.token0Addr, this.token1Addr);
        this.poolContract = new web3.eth.Contract(tokenAbi, this.poolAddr);

        this.reserve0 = _amount0;
        this.reserve1 = _amount1;

        this.baseNonce = txCount + 3*idx;
    }

    constructApproveTx = async (approveTokenAddr, txIdxInBatch=0) => {
        const txNonce = this.baseNonce + txIdxInBatch;
        
        const tx =  {
            // this could be provider.addresses[0] if it exists
            from: acc.address,
            // target address, this could be a smart contract address
            to: approveTokenAddr,
            gas: maxGas,
            // gasPrice: adjustedGasPrice,
            nonce: txNonce,
            // this encodes the ABI of the method and the arguements
            data: this.poolContract.methods.approve(
                acyRouterAddr,
                maxAmount
            ).encodeABI()
        };
        return tx
    }
    
    constructAddTx = (_amount0, _amount1, txIdxInBatch=0) => {
        const txNonce = this.baseNonce + txIdxInBatch;
        // console.log("> Approve nonce: ", txNonce);
        return {
            // this could be provider.addresses[0] if it exists
            from: acc.address,
            // target address, this could be a smart contract address
            to: acyRouterAddr,
            gas: maxGas,
            // gasPrice: adjustedGasPrice,
            nonce: txNonce,
            // this encodes the ABI of the method and the arguements
            data: routerContract.methods.addLiquidity(
                this.token0Addr,
                this.token1Addr,
                _amount0,
                _amount1,
                0,
                0,
                this.poolAddr,
                Date.now() + 1000 * 60 * 5
            ).encodeABI()
        }
    };
    
    constructRemoveTx = (_amount) => {
        return {
            // this could be provider.addresses[0] if it exists
            from: acc.address,
            // target address, this could be a smart contract address
            to: acyRouterAddr,
            gas: maxGas,
            // this encodes the ABI of the method and the arguements
            data: routerContract.methods.removeLiquidity(
                this.token0Addr,
                this.token1Addr,
                web3.utils.toWei(_amount.toString(), "ether"),
                0,
                0,
                web3.utils.toChecksumAddress(acc.address),
                Date.now() + 1000 * 60 * 5
            ).encodeABI()
        }
    }
    
    constructSwapTx = (_amountIn) => {
        return {
            // this could be provider.addresses[0] if it exists
            from: acc.address,
            // target address, this could be a smart contract address
            to: acyRouterAddr,
            gas: maxGas,
            // this encodes the ABI of the method and the arguements
            data: routerContract.methods.swapExactTokensForTokens(
                web3.utils.toWei(_amountIn.toString(), "ether"),
                0,
                [this.token0Addr, this.token1Addr],
                web3.utils.toChecksumAddress(acc.address),
                Date.now() + 1000 * 60 * 5
            ).encodeABI()
        }
    }
    
    ////// EXECUTE TX
    
    executeTx = async (_tx) => {
        // console.log("Tx sent")
        const signedTx = await web3.eth.accounts.signTransaction(_tx, privateKey);
        const sentTx = await web3.eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction);
        // console.log(sentTx);
        // console.log("Tx done");
        return sentTx;
    }

    addLiquidity = async () => {
        const executionResult = {
            id: this.poolAddr,
            token0: this.token0Addr,
            token1: this.token1Addr
        };
        // check if pool being deposited before
        console.log("check pool address ", this.poolAddr)
        
        try {
            

            // approve 2 tokens
            const tx0 = await this.constructApproveTx(this.token0Addr, 0);
            const tx1 = await this.constructApproveTx(this.token1Addr, 1);
            const approveReceipts = await Promise.allSettled([this.executeTx(tx0), this.executeTx(tx1)]);
            console.log("sent approve", this.token0Addr, this.token1Addr)
            
            let failTx = approveReceipts.find(r => r.status != "fulfilled");
            if (failTx >= 0) {
                throw "Approve failed";
            } else {
                executionResult.approveReceipts = approveReceipts;
            }
    
            // add liquidity
            const tx = this.constructAddTx(this.reserve0, this.reserve1, 2);
            const txReceipt = await this.executeTx(tx);
            console.log("sent tx")
            // console.log(txReceipt);
            
            executionResult.txReceipt = txReceipt;
            executionResult.status = true;
            console.log(`Successful ${this.poolAddr}`);
            fs.appendFileSync("./successfulPool.json", `${this.poolAddr}\n`)
        } catch (err) {
            executionResult.status = false;
            console.log(`Failed ${this.poolAddr}: ${err}`);
            fs.appendFileSync("./unsuccessfulPool.json", `${this.poolAddr}\n`)
        }

        return executionResult;

    }
}

const digitToName = (floatStr, numOfDecimals) => {
    let digit = parseInt(numOfDecimals)
    const dotIdx = floatStr.indexOf(".")
    const decimals = floatStr.slice(dotIdx+1)
    const numDecimal = decimals.length
    let converted;
    if (digit >= numDecimal) {
        converted = floatStr.slice(0, dotIdx) + decimals + "0".repeat(digit - numDecimal)
    } else {
        converted = floatStr.slice(0, dotIdx) + decimals.slice(0, digit)
    }
    return converted;
}

const checkIfDeposited = async (_token0, _token1) => {
    const poolAddr = getPairAddress(_token0, _token1)
    try {
        const balance = await this.poolContract.methods.balanceOf(poolAddr).call();
        // console.log(`balance in liquidity pool ${this.poolAddr}`, balance)
        // process.exit(1)
        if (balance > 0)
            console.log(`pool address ${poolAddr} exists already, skipping`)
    } catch {
        console.log(">> proceed")
    }
}

import uniswapData from "../log/uniswapData.json";
import successfulData from "../successfulPool.json";
const main = async () => {
    console.log("length of uniswapData", uniswapData.length)
    // // get uniswap reserve data
    // let uniswapData = await theGraphDriver();
    // console.log("ended with uniswap of length ", uniswapData.length)
    // fs.writeFileSync("./log/uniswapData.json", JSON.stringify(uniswapData));
    // process.exit(1)


    txCount = await web3.eth.getTransactionCount(acc.address);
    console.log("!!!!current txCount: ", txCount);
    // txCount = 37;
    adjustedGasPrice = await web3.eth.getGasPrice();
    adjustedGasPrice = parseInt(adjustedGasPrice) * 1.1;
    console.log("adjustedGasPrice", adjustedGasPrice)

    // loop through uniswap data and see if tokens exists in our BSC list
    let taskCount = 0;
    const tasks = [];
    const startTime = new Date();
    const unprocessedPairs = uniswapData.reverse().slice(66, uniswapData.length-3);
    for (const pair of unprocessedPairs) {
        

        const token0 = pair.token0;
        const token1 = pair.token1;
        console.log("pair checking: ", token0, token1)
        if (token0 == "ETH" || token0 == "WETH" || token1 == "ETH" || token1 == "WETH") {
            console.log("skip eth")
            continue;
        }
        
        const tokenIdx0 = BSCtokenList.find(t => t.symbol == token0);
        const tokenIdx1 = BSCtokenList.find(t => t.symbol == token1);
        if (!tokenIdx0 || !tokenIdx1) {
            console.log(`${token0} or ${token1} does not exists on bsc`);
            continue;
        }

        
        const token0Addr = tokenIdx0.address;
        const token1Addr = tokenIdx1.address;
        const reserves0 = pair.reserve0;
        const reserves1 = pair.reserve1;
        const ifDeposited = await checkIfDeposited(token0Addr, token1Addr)
        if (ifDeposited) {
            continue;
        }
        
        const idx = taskCount;
        taskCount++;

        const reserves0BN = digitToName(reserves0, tokenIdx0.decimals);
        const reserves1BN = digitToName(reserves1, tokenIdx1.decimals);

        // console.log("transaction params", token0Addr, token1Addr, reserves0BN, reserves1BN);

        

        const task = async () => {
            const liquidityCreator = new PoolCreater(
                token0Addr,
                token1Addr,
                reserves0BN,
                reserves1BN,
                idx
            )
            const executionResult = await liquidityCreator.addLiquidity();
            console.log(`Finished task ${idx}. Time from start: ${new Date() - startTime}`);
            return executionResult;
        };
        tasks.push(task());
        console.log("Dispatched task ", idx);

        // // TEST !!!!
        // if (taskCount == 3) {
        //     break;

        // }
    }

    const res = await Promise.allSettled(tasks);

    console.log("tasks res", res)
    fs.writeFile("./log/addRes.json", JSON.stringify(res), err => {console.log(err)});
    
    console.log("Failed count: ", res.filter(r => r.value.status == false).length || 0);

    fs.writeFile("./log/addLiquidityLog.json", JSON.stringify(res), err => {console.log(err)});

    // process.exit(1);

    // // add liquidity

//     txCount = await web3.eth.getTransactionCount(acc.address);

//     const pairs = [
//         ["0x986BEaaA0252A5fa3E2eD345F1b672B87d8E52a2", "0x3Fb7417C73d4A4Dd96E3D526A66D95C47a5727Af"],
//         ["0x0635937fe3eFd430235fFd985Fa68f64DC17920A", "0xA6983722023c67Ff6938FF2adc1d7fC61B5966f3"],
//         ["0xff1c9fb592b5d61fC92034888d0Dbc540B76D42A", "0xA6983722023c67Ff6938FF2adc1d7fC61B5966f3"]
// ];

//     const ETHpairs = [["0xc778417E063141139Fce010982780140Aa0cD5Ab", "0xA6983722023c67Ff6938FF2adc1d7fC61B5966f3"]]
//     let taskCount = 0;
//     const tasks = [];
//     const startTime = new Date();
//     // for (let i=0; i<TokenList.length; i++) {
//     //     for (let j=i+1; j<TokenList.length; j++) {
//     for (let i=3; i<6; i++) {
//         for (let j=i+1; j<6; j++) {
//             const idx = taskCount;
//             taskCount++;
//             const task = async () => {
//                 const token0 = TokenList[i].address;
//                 const token1 = TokenList[j].address;
//                 const liquidityCreator = new PoolCreater(
//                     token0,
//                     token1,
//                     20,
//                     10,
//                     idx
//                 )
//                 const executionResult = await liquidityCreator.addLiquidity();
//                 console.log(`Finished task ${idx}. Time from start: ${new Date() - startTime}`);
//                 return executionResult;
//             };
//             tasks.push(task());
//             console.log("Dispatched task ", idx);
//         }
//     }

    
}

main();