export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { jwtVerify, importSPKI } from "jose";
import prisma from "@/service/db";
import { readFile } from "fs/promises";
import path from "path";
import type { Role } from "@prisma/client";

const ISSUER = process.env.SSO_ISSUER!;
const AUD = process.env.SSO_AUDIENCE!;

let PUB_CACHE: string | null = null;
async function getPortalPublicKey(): Promise<string> {
  if (PUB_CACHE) return PUB_CACHE;
  const p = process.env.PORTAL_PUBLIC_KEY_PATH;
  if (!p) throw new Error("PORTAL_PUBLIC_KEY_PATH not set");
  const full = p.startsWith("/") ? p : path.resolve(process.cwd(), p);
  PUB_CACHE = await readFile(full, "utf8");
  return PUB_CACHE;
}

const ALLOWED_ROLES: Role[] = ["TRANSCRIBER", "REVIEWER", "FINAL_REVIEWER"];

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") || "");
  if (!token) return new NextResponse("Missing token", { status: 400 });

  let payload: any;
  try {
    const pem = await getPortalPublicKey();
    const key = await importSPKI(pem, "RS256");
    const { payload: p } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUD });
    payload = p;
  } catch {
    return new NextResponse("Invalid token", { status: 401 });
  }

  const email = String(payload.email || "");
  if (!email) return new NextResponse("Email missing", { status: 400 });

  const claim = Array.isArray(payload.tools) ? payload.tools.find((t: any) => t.tool === AUD) : undefined;
  const claimRoleRaw = typeof claim?.role === "string" ? String(claim.role).toUpperCase() : "";
  const isValidRole = (ALLOWED_ROLES as string[]).includes(claimRoleRaw);
  const roleFromJwt = (isValidRole ? (claimRoleRaw as Role) : undefined);

  const username = email;

  await prisma.user.upsert({
    where: { email },
    // On update: keep existing role if claim invalid by not setting role
    update: roleFromJwt ? { name: username, role: roleFromJwt } : { name: username },
    // On create: default to TRANSCRIBER if claim invalid
    create: { name: username, email, role: roleFromJwt ?? "TRANSCRIBER", group_id: 0 },
  });

  return NextResponse.redirect(new URL(`/?session=${encodeURIComponent(username)}`, req.url), 302);
}