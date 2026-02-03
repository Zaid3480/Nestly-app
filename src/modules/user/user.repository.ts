import pool from "../../config/db.config";
import { UserEntity } from "./user.entity";

export class AdminRepository {
  static async findByEmail(email: string): Promise<UserEntity | null> {
    const query = `
      SELECT *
      FROM users
      WHERE email = $1
      LIMIT 1
    `;

    const result = await pool.query<UserEntity>(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}
