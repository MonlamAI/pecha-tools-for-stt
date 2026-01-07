"use client";

import React, { useState, useEffect } from "react";
import { getAllGroup } from "@/model/group";
import GroupDashboard from "./GroupDashboard";
import { getAllDepartment } from "@/model/department";

const Group = () => {
  const [groupList, setGroupList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [groupsData, deptsData] = await Promise.all([
          getAllGroup(),
          getAllDepartment()
        ]);

        if (groupsData && !("error" in groupsData)) setGroupList(groupsData);
        if (deptsData && !("error" in deptsData)) setDepartments(deptsData);
      } catch (error) {
        console.error("Error fetching group/dept data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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
      <GroupDashboard groupList={groupList} departments={departments} />
    </>
  );
};

export default Group;
