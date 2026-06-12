"use client";

import React, { useState, useEffect, Suspense } from "react";
import { getAllDepartment } from "@/model/department";
import DepartmentReport from "./DepartmentReport";

const Department = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const data = await getAllDepartment();
        if (data && !data.error) {
          setDepartments(data);
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    }>
      <DepartmentReport departments={departments} />
    </Suspense>
  );
};

export default Department;
