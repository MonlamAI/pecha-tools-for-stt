"use client";

import React, { useState, useEffect } from "react";
import { getAllGroup } from "@/model/group";
import { getAllGroupTaskStats as getOptimizedGroupTaskStats } from "@/service/group-service";
import StatsContainer from "./StatsContainer";

const Stats = () => {
  const [groupStatByDept, setGroupStatByDept] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const allGroup = await getAllGroup();
        if (allGroup && !allGroup.error) {
          const stats = await getOptimizedGroupTaskStats(allGroup);
          setGroupStatByDept(stats);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
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
      {groupStatByDept && groupStatByDept.length > 0 && (
        <StatsContainer groupStatByDept={groupStatByDept} />
      )}
    </>
  );
};

export default Stats;
