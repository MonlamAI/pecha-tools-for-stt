"use client";

import React, { useState, useEffect, useCallback } from "react";
import DepartmentDashboard from "./DepartmentDashboard";
import { getAllDepartment } from "@/model/department";

const Department = () => {
  const [departmentList, setDepartmentList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <>
      <DepartmentDashboard
        departmentList={departmentList}
        onDone={fetchDepartments}
      />
    </>
  );
};

export default Department;
