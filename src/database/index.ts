import pool from "../config/db.config";

export const connectDB = async (): Promise<void> => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected successfully");
  } catch (error) {
    console.error("❌ PostgreSQL connection failed");
    console.error(error);
    process.exit(1);
  }
};
