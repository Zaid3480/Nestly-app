import express from "express";
import userRoutes from "./modules/user/user.routes";


const app = express();

app.use(express.json());

app.use("/api/user", userRoutes);

export default app;
