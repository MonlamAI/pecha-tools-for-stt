import React from "react";
import TaskDashbooard from "./TaskDashbooard";
import { getAllGroup } from "@/model/group";
import { getAllTask } from "@/model/task";
import { logPageAccess } from "@/lib/logger";

const Task = async ({ searchParams }) => {
  await logPageAccess("/dashboard/task", { searchParams });
  const groups = await getAllGroup();

  return (
    <>
      <TaskDashbooard groups={groups} searchParams={searchParams} />
    </>
  );
};

export default Task;
