import { getAllGroup } from "@/model/group";
import React from "react";
import GroupDashboard from "./GroupDashboard";
import { getAllDepartment } from "@/model/department";
import { logPageAccess } from "@/lib/logger";
export const dynamic = "force-dynamic";

const Group = async () => {
  await logPageAccess("/dashboard/group");
  const groupList = await getAllGroup();
  const departments = await getAllDepartment();

  // console.log("group page:", { departments, groupList });

  // return <pre>{JSON.stringify({ groupList, departments }, null, 2)}</pre>;
  return (
    <>
      <GroupDashboard groupList={groupList} departments={departments} />
    </>
  );
};

export default Group;
