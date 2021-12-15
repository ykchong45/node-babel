// const axios = require('axios');
import axios from 'axios'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256, pack } from '@ethersproject/solidity'
import uniswapTokenList from './TokenList.js';

//Constant

//ACY
// var FACTORY_ADDRESS = '0xb43DD1c50377b6dbaEBa3DcBB2232a3964b22440'
// var INIT_CODE_HASH = '0xfbf3b88d6f337be529b00f1dc9bff44bb43fa3c6b5b7d58a2149e59ac5e0c4a8'

//Uniswap
var FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
var INIT_CODE_HASH = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'
const uniswapURL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2" ; // https://thegraph.com/explorer/subgraph/uniswap/uniswap-v2

//Graphql
const queryLP = async (id) =>{
    try {
        const result = await axios.post(
            uniswapURL,
            {
                query: `
                {
                  pairs (where:{id:"${id}"}){
                    id
                    token0 {
                      id
                      symbol
                    }
                    reserve0
                    token1 {
                      id
                      symbol
                    }
                    reserve1
                  }
                }                           
                `
            }
            );           
          return (result.data.data);
          // console.log ("Query result: \n", result.data.data);
    } catch (err){
        console.log(err);
    }
}

const fetchPoolData = async (i, x) => {
  // get token Symbol
  const tokenASymbol = uniswapTokenList[i].symbol;
  const tokenBSymbol = uniswapTokenList[x].symbol;
  // get token address and sort
  const tokenAAddress = uniswapTokenList[i].addressOnEth;
  const tokenBAddress = uniswapTokenList[x].addressOnEth;

  var tokens =  [tokenAAddress, tokenBAddress];
  tokens.sort()

  // generating LPaddress
  const LPaddress = (getCreate2Address(
                    FACTORY_ADDRESS,
                    keccak256(['bytes'], [pack(['address', 'address'], tokens)]),
                    INIT_CODE_HASH)).toLowerCase()
              
  // sending query with LP address
  const LPdata = await queryLP(LPaddress);
  
  if(LPdata.pairs[0]){
    const availableData = LPdata.pairs[0];
    availableData.available = true;
    console.log("successful", availableData.id)
    return availableData;
  }
  else{
    const unavailableData = {
      id: LPaddress,
      available: false,
      token0: {id: tokenAAddress, symbol: tokenASymbol},
      token1: {id: tokenBAddress, symbol: tokenBSymbol}
    };
    console.log("failed", unavailableData.id)
    return unavailableData;
  }
}

//Driver Program
export default async () => {

  const fetchTasks = [];
  console.log("start to fetch ...")
  // for (let i = 0; i < 15; i++) { 
  //   for (let x = 0; x < 15; x++) { 
  for (let i = 0; i < uniswapTokenList.length; i++) { 
    for (let x = 0; x < uniswapTokenList.length; x++) { 
      if(i!==x){
        fetchTasks.push(fetchPoolData(i, x));
      }
    }
  }
  
  const fetchedResult = await Promise.allSettled(fetchTasks);
  const poolResult = fetchedResult.map(p => p.value);
  const availablePool = poolResult.filter(p => p.available == true);
  const unavailablePool = poolResult.filter(p => p.available == false);
  
  const reformedData = availablePool.map(p => ({
    token0: p.token0.symbol,
    token1: p.token1.symbol,
    reserve0: p.reserve0,
    reserve1: p.reserve1
  }));
  
  console.log(reformedData);
  console.log("available length", availablePool.length);
  console.log("unavailable length", unavailablePool.length);

  return reformedData;

}


// import fs from "fs";

// // fs.writeFileSync('./availablePools.json', JSON.stringify(availablePool));
// // fs.writeFileSync('./unavailablePools.json', JSON.stringify(unavailablePool));