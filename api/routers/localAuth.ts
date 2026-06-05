import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { query, queryOne, run } from "../lib/db-helper";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "omegaelz-crm-secret-key-2026";

function generateToken(user: any) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "manager", "sales", "support"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if username already exists
      const existing = queryOne("SELECT * FROM local_users WHERE username = ?", [input.username]);

      if (existing) {
        throw new Error("Username already exists");
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const result = run(
        "INSERT INTO local_users (username, passwordHash, name, email, role) VALUES (?, ?, ?, ?, ?)",
        [input.username, passwordHash, input.name ?? input.username, input.email ?? null, input.role ?? "sales"]
      );

      const user = queryOne("SELECT * FROM local_users WHERE id = ?", [result.lastInsertRowid]);

      const token = generateToken(user);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

  login: publicQuery
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const user = queryOne("SELECT * FROM local_users WHERE username = ?", [input.username]);

      if (!user) {
        throw new Error("Invalid username or password");
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);

      if (!valid) {
        throw new Error("Invalid username or password");
      }

      const token = generateToken(user);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

  me: publicQuery.query(({ ctx }) => {
    // Check for local auth token in headers
    const authHeader = ctx.req.headers.get("x-local-auth-token");
    if (!authHeader) return null;

    try {
      const decoded = jwt.verify(authHeader, JWT_SECRET) as any;
      const user = queryOne("SELECT * FROM local_users WHERE id = ?", [decoded.id]);

      if (!user) return null;

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        isActive: user.isActive,
      };
    } catch {
      return null;
    }
  }),
});
