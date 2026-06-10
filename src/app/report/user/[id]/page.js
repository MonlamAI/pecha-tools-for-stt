import React from "react";
import { getAllUser } from "@/model/user";
import UserReport from "./UserReport";
import { logPageAccess } from "@/lib/logger";

const User = async ({ searchParams, params }) => {
  const { id } = params;
  await logPageAccess("/report/user/[id]", { params: { id }, searchParams });
  const users = await getAllUser();

  return <UserReport id={id} users={users} searchParams={searchParams} />;
};

export default User;
