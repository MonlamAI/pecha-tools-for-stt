export const runtime = "nodejs";

import prisma from "@/service/db";
import { NextResponse } from "next/server";
import { withAccessLog } from "@/lib/logger/with-access-log";

import { mapping } from "@/../../data/mapping";

export const GET = withAccessLog(async (request, { params }) => {
  if (mapping.has(params.email)) {
    return NextResponse.json(mapping.get(params.email));
  } else {
    var user = await prisma.user.findFirst({
      where: {
        email: params.email,
      },
    });
    if (user === null) {
      return NextResponse.json({ error: "No such email" }, { status: 404 });
    }

    user.url = `https://pecha-tools-for-stt.onrender.com/?session=${user.name}`;
    user.department = "stt";

    // List of properties to delete
    const propertiesToDelete = ["id", "name", "email", "group_id", "role"];

    // Delete each property in the list
    propertiesToDelete.forEach((property) => {
      if (user.hasOwnProperty(property)) {
        delete user[property];
      }
    });

    return NextResponse.json(user);
  }
});
