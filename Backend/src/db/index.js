import mongoose from "mongoose";
import { dbName } from "../constants.js";

export const connectDB = async () => {
  try {
    const connectionResponse = await mongoose.connect(
      `${process.env.MONDODB_URI}`
    );
    console.log(
      "Connection with MongoDB is successfull, DB host:",
      connectionResponse.connection.host
    );
  } catch (error) {
    console.log("MongoDB connection failed", error);
    process.exit(1);
  }
};
