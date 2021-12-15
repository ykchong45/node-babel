const idx = 0;

const privateKey = 'c4068ac9e796baaf5129508ec8550cfeaabb79959002969f68e11f01b9c1aca9';

const token0 = web3.utils.toChecksumAddress("0x986BEaaA0252A5fa3E2eD345F1b672B87d8E52a2");  // UMA
const token1 = web3.utils.toChecksumAddress("0x3Fb7417C73d4A4Dd96E3D526A66D95C47a5727Af");  // TBTC
const poolAddr = getPairAddress(token0, token1);
const testingPool = "0x3e504C77d1dd3C3Ab162B3abe64EBA492b183f03";
const acyRouter = "0x9c040CC3CE4B2C135452370Eed152A72ce5d5b18";

///// CONSTANT

const maxGas = 10000000;

///////
const setup = async () => {
    const acc = web3.eth.accounts.privateKeyToAccount("0x" + privateKey);
    const txCount = await web3.eth.getTransactionCount(acc.address);
    
    const token0Contract = new web3.eth.Contract(tokenAbi, token0);
    const token1Contract = new web3.eth.Contract(tokenAbi, token1);
    const poolContract = new web3.eth.Contract(tokenAbi, poolAddr);
    const routerContract = new web3.eth.Contract(routerAbi, acyRouterAddr);

    return {acc, txCount, poolContract, routerContract};
}

const {acc, txCount, poolContract, routerContract} = await setup();

/////// CONSTRUCT TX

const constructApproveTx = async (approveTokenAddr, txIdxInBatch=0) => {
    const maxAmount = web3.utils.toBN(2 ** 64 - 1).toString() + "0".repeat(18);
    const txNonce = txCount + txIdxInBatch;
    console.log("> Approve nonce: ", txNonce);
    return {
        // this could be provider.addresses[0] if it exists
        from: acc.address,
        // target address, this could be a smart contract address
        to: approveTokenAddr,
        gas: maxGas,
        nonce: txNonce,
        // this encodes the ABI of the method and the arguements
        data: poolContract.methods.approve(
            acyRouterAddr,
            maxAmount
        ).encodeABI()
    };
}

const constructAddTx = (_amount0, _amount1, txIdxInBatch=0) => {
    const txNonce = txCount + txIdxInBatch;
    console.log("> Approve nonce: ", txNonce);
    return {
        // this could be provider.addresses[0] if it exists
        from: acc.address,
        // target address, this could be a smart contract address
        to: acyRouterAddr,
        gas: maxGas,
        nonce: txNonce,
        // this encodes the ABI of the method and the arguements
        data: routerContract.methods.addLiquidity(
            token0,
            token1,
            web3.utils.toWei(_amount0.toString(), "ether"),
            web3.utils.toWei(_amount1.toString(), "ether"),
            0,
            0,
            poolAddr,
            Date.now() + 1000 * 60 * 5
        ).encodeABI()
    }
};

const constructRemoveTx = (_amount) => {
    return {
        // this could be provider.addresses[0] if it exists
        from: acc.address,
        // target address, this could be a smart contract address
        to: acyRouterAddr,
        gas: maxGas,
        // this encodes the ABI of the method and the arguements
        data: routerContract.methods.removeLiquidity(
            token0,
            token1,
            web3.utils.toWei(_amount.toString(), "ether"),
            0,
            0,
            web3.utils.toChecksumAddress(acc.address),
            Date.now() + 1000 * 60 * 5
        ).encodeABI()
    }
}

const constructSwapTx = (_amountIn) => {
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
            [token0, token1],
            web3.utils.toChecksumAddress(acc.address),
            Date.now() + 1000 * 60 * 5
        ).encodeABI()
    }
}

////// EXECUTE TX

const executeTx = async (_tx) => {
    console.log("Tx sending ...")
    const signedTx = await web3.eth.accounts.signTransaction(_tx, privateKey);
    const sentTx = await web3.eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction);
    console.log(sentTx);
    console.log("Tx done");
    return sentTx;
}


//////

const successPool = [];
const failedPool = [];
const main = async () => {


    const executionResult = {
        id: poolAddr,
        token0,
        token1
    };
    
    try {
        // approve 2 tokens
        const tx0 = await constructApproveTx(token0, 0*idx);
        const tx1 = await constructApproveTx(token1, 1*idx);
        const receipts = await Promise.allSettled([executeTx(tx0), executeTx(tx1)]);
        
        let failTx = receipts.find(r => r.status != "fulfilled");
        if (failTx >= 0) {
            throw "Approve failed";
        }

        // add liquidity
        const tx = constructAddTx(20, 10, 2*idx);
        const receipt = await executeTx(tx);
        console.log(receipt);
    
        
        executionResult.success = true;
        successPool.push(executionResult);
        console.log(`Successful ${poolAddr}`);
        
    } catch (err) {
        executionResult.success = false;
        failedPool.push(executionResult);
        console.log(`Failed ${poolAddr}`);
    }

    console.log(successPool, failedPool);
    console.log("End of program.");

}

main();


