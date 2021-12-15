import mongoose from "mongoose";
import config from "../config/index.js";

const pairModel = {
    name: "pairModel",
    // Notice the require syntax and the '.default'
    model: require("../models/pair").default,
  };

  const subscriberModel = {
    name: "subscriberModel",
    // Notice the require syntax and the '.default'
    model: require("../models/subscriber").default,
  };

  const userPoolModel = {
    name: "userPoolModel",
    model: require("../models/userPool").default,
  };

  const pairVolumeModel = {
    name: "pairVolumeModel",
    model: require("../models/pairVolume").default,
  };

  const mongoConnection = (async () => {
    const connection = await mongoose.connect(config.databaseURL, {
    dbName: config.databaseName,
    user: config.databaseUser,
    pass: config.databasePass,
  });
  return connection.connection.db;
})();


export default {
    mongoConnection,
    models: [
        pairModel,
        subscriberModel,
        userPoolModel,
        pairVolumeModel,
      ],
}