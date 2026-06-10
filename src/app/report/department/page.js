import React from "react";
import { getAllDepartment } from "@/model/department";
import DepartmentReport from "./DepartmentReport";
import { logPageAccess } from "@/lib/logger";

const Department = async () => {
  await logPageAccess("/report/department");
  const departments = await getAllDepartment();
  return (
    <>
      <DepartmentReport departments={departments} />
    </>
  );
};

export default Department;
