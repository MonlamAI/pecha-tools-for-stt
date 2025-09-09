import DepartmentDashboard from "./DepartmentDashboard";
import { getAllDepartment } from "@/model/department";
export const dynamic = "force-dynamic";

const Department = async () => {
  const departmentList = await getAllDepartment();
  // console.log({ departmentList })

  return (
    <>
      <DepartmentDashboard departmentList={departmentList} />
    </>
  );
};

export default Department;
