  import { Request, Response } from "express";
  import jwt from "jsonwebtoken";
  import { OAuth2Client } from "google-auth-library";
  import pool from "../../config/db.config";

  const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  
export class UserController {


static async googleAuth(req: Request, res: Response) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_WEB_CLIENT_ID!,
        process.env.GOOGLE_ANDROID_CLIENT_ID!,
        process.env.GOOGLE_IOS_CLIENT_ID!,
      ],
    });

    const payload = ticket.getPayload();

    console.log(payload);

    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ message: "Invalid Google token" });
    }

    const email = payload.email;
    const googleSub = payload.sub;

    // ✅ PROPER name extraction (DO NOT split payload.name)
    const firstName = payload.given_name ?? null;
    const lastName = payload.family_name ?? null;

    let user;

    // 1️⃣ Find by google_sub FIRST
    const bySub = await pool.query(
      `SELECT * FROM users WHERE google_sub = $1 LIMIT 1`,
      [googleSub]
    );

    if (bySub.rowCount) {
      user = bySub.rows[0];
    } else {
      // 2️⃣ Fallback: find by email
      const byEmail = await pool.query(
        `SELECT * FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );

      if (byEmail.rowCount) {
        user = byEmail.rows[0];

        // 🚫 Block inactive users
        if (!user.is_active) {
          return res.status(403).json({ message: "Account is disabled" });
        }

        // 3️⃣ Attach google_sub + save name ONLY if missing
        if (!user.google_sub) {
          await pool.query(
            `
            UPDATE users
            SET
              google_sub = $1,
              auth_provider = 'GOOGLE',
              first_name = COALESCE(first_name, $2),
              last_name = COALESCE(last_name, $3)
            WHERE id = $4
            `,
            [googleSub, firstName, lastName, user.id]
          );

          user.google_sub = googleSub;
          user.auth_provider = "GOOGLE";
        }
      }
    }

    // 4️⃣ Create user if still not found
    if (!user) {
      const insert = await pool.query(
        `
        INSERT INTO users (
          email,
          first_name,
          last_name,
          role,
          is_active,
          auth_provider,
          google_sub,
          password_hash
        )
        VALUES ($1, $2, $3, 'USER', true, 'GOOGLE', $4, NULL)
        RETURNING *
        `,
        [email, firstName, lastName, googleSub]
      );

      user = insert.rows[0];
    }

    // 🔑 Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("Google auth error:", error);
    return res.status(500).json({
      message: "Google authentication failed",
    });
  }
}


static async updateProfile(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      id,
      interests,
      furnishing,
      budget,
      preferredLocations,
      birthDate,
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: "User id is required" });
    }

    
    if (id !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "You are not allowed to update this profile",
      });
    }

    
    if (interests && !Array.isArray(interests)) {
      return res.status(400).json({
        message: "interests must be an array of strings",
      });
    }

    if (preferredLocations && !Array.isArray(preferredLocations)) {
      return res.status(400).json({
        message: "preferredLocations must be an array of strings",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        interests = COALESCE($1, interests),
        furnishing = COALESCE($2, furnishing),
        budget = COALESCE($3, budget),
        preferred_locations = COALESCE($4, preferred_locations),
        birth_date = COALESCE($5, birth_date)
      WHERE id = $6
      RETURNING id
      `,
      [
        interests ?? null,              
        furnishing ?? null,
        budget ?? null,
        preferredLocations ?? null,   
        birthDate ?? null,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
    });

  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      message: "Failed to update profile",
    });
  }
}


static async getProfile(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const paramUserId = req.params.id;

    if (!paramUserId) {
      return res.status(400).json({ message: "User id is required" });
    }

  
    if (paramUserId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "You are not allowed to view this profile",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        first_name,
        last_name,
        role,
        interests,
        furnishing,
        budget,
        preferred_locations,
        birth_date
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [paramUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    return res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      interests: user.interests ?? [],               
      furnishing: user.furnishing,
      budget: user.budget,
      preferredLocations: user.preferred_locations ?? [], 
      birthDate: user.birth_date
        ? user.birth_date.toISOString().split("T")[0]
        : null,
    });

  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      message: "Failed to fetch profile",
    });
  }
}

static async deleteProfile(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const paramUserId = req.params.id;
  

    // 🔍 Check if user exists & active
    const check = await pool.query(
      `SELECT is_active FROM users WHERE id = $1`,
      [paramUserId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!check.rows[0].is_active) {
      return res.status(400).json({
        message: "Profile is already deleted",
      });
    }

    // 🗑️ Soft delete
    await pool.query(
      `
      UPDATE users
      SET is_active = false
      WHERE id = $1
      `,
      [paramUserId]
    );

    return res.status(200).json({
      message: "Profile deleted successfully",
    });

  } catch (error) {
    console.error("Delete profile error:", error);
    return res.status(500).json({
      message: "Failed to delete profile",
    });
  }
}


static async createProfile(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      interests,
      furnishing,
      budget,
      preferredLocations,
      birthDate,
    } = req.body;

    const userId = req.user.id;

    // ✅ Validation
    if (!Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({
        message: "interests must be a non-empty array of strings",
      });
    }

    if (preferredLocations && !Array.isArray(preferredLocations)) {
      return res.status(400).json({
        message: "preferredLocations must be an array of strings",
      });
    }

    // 🔍 Check if profile already created
    const check = await pool.query(
      `
      SELECT
        interests,
        budget,
        furnishing,
        preferred_locations,
        birth_date
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const existing = check.rows[0];

    const profileAlreadyExists =
      (existing.interests && existing.interests.length > 0) ||
      existing.budget !== null ||
      existing.furnishing !== null ||
      (existing.preferred_locations &&
        existing.preferred_locations.length > 0) ||
      existing.birth_date !== null;

    if (profileAlreadyExists) {
      return res.status(400).json({
        message: "Profile already created. Use update profile.",
      });
    }

    // ✅ Create profile (arrays go directly)
    await pool.query(
      `
      UPDATE users
      SET
        interests = $1,
        furnishing = $2,
        budget = $3,
        preferred_locations = $4,
        birth_date = $5
      WHERE id = $6
      `,
      [
        interests,                 // 👈 TEXT[]
        furnishing ?? null,
        budget ?? null,
        preferredLocations ?? null, // 👈 TEXT[]
        birthDate ?? null,
        userId,
      ]
    );

    return res.status(201).json({
      message: "Profile created successfully",
    });

  } catch (error) {
    console.error("Create profile error:", error);
    return res.status(500).json({
      message: "Failed to create profile",
    });
  }
}

}
