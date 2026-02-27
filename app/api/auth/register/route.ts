import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email)
  });

  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);
  await db.insert(users).values({ email, passwordHash });

  return NextResponse.json({ ok: true }, { status: 201 });
}
