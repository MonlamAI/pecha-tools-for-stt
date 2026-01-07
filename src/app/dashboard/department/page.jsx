"use client";

import React, { useState, useEffect } from "react";
import DepartmentDashboard from "./DepartmentDashboard";
import { getAllDepartment } from "@/model/department";

const Department = () => {
  const [departmentList, setDepartmentList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const data = await getAllDepartment();
        if (data && !data.error) {
          setDepartmentList(data);
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDepartments();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <>
      <DepartmentDashboard departmentList={departmentList} />
    </>
  );
};

export default Department;
