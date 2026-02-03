import app from "./app";
import { connectDB } from "./database";

import dotenv from "dotenv";
dotenv.config();


const PORT = 5000;

const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
