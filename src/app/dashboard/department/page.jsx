import DepartmentDashboard from "./DepartmentDashboard";
import { getAllDepartment } from "@/model/department";
import { logPageAccess } from "@/lib/logger";
export const dynamic = "force-dynamic";

const Department = async () => {
  await logPageAccess("/dashboard/department");
  const departmentList = await getAllDepartment();
  // console.log({ departmentList })

  return (
    <>
      <DepartmentDashboard departmentList={departmentList} />
    </>
  );
};

export default Department;
