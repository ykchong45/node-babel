import mongoConnection from "./mongoose.js";
import web3 from "web3";
import config from "../config/index.js";

const Web3Instance = new web3(config.rpcURL);

export default {
    mongoConnection,
    Web3Instance,
}