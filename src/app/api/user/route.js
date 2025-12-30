export const runtime = "nodejs";

import prisma from "@/service/db";
import { NextResponse } from "next/server";

export async function GET() {
  // get all user
  try {
    const users = await prisma.user.findMany({});
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error creating post:", error);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, email, group_id, role } = body;

    // Validate required fields
    if (!id || !name || !email || !group_id || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if username and email already exists (excluding current user)
    const userByName = await prisma.user.findFirst({
      where: {
        name: name,
        NOT: { id: parseInt(id) }
      }
    });

    const userByEmail = await prisma.user.findFirst({
      where: {
        email: email,
        NOT: { id: parseInt(id) }
      }
    });

    if (userByName && userByEmail) {
      return NextResponse.json(
        { error: "User already exists with the same username and email" },
        { status: 400 }
      );
    } else if (userByName) {
      return NextResponse.json(
        { error: "User already exists with the same username" },
        { status: 400 }
      );
    } else if (userByEmail) {
      return NextResponse.json(
        { error: "User already exists with the same email" },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        email: email.trim(),
        group_id: parseInt(group_id),
        role: role
      }
    });

    return NextResponse.json({
      success: "User updated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}