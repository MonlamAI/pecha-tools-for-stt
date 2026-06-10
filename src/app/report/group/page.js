import React from "react";
import { getAllGroup } from "@/model/group";
import GroupReport from "./GroupReport";
import { logPageAccess } from "@/lib/logger";

const Group = async () => {
  await logPageAccess("/report/group");
  const groups = await getAllGroup();

  return <GroupReport groups={groups} />;
};

export default Group;
