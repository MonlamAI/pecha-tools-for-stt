import { getAllGroup, getAllGroupTaskStats } from "@/model/group";
import { getAllGroupTaskStats as getOptimizedGroupTaskStats } from "@/service/group-service";
import { STATS_CONFIG } from "@/constants/config";
import React from "react";
import StatsContainer from "./StatsContainer";

// Using service layer optimization with caching
export const revalidate = STATS_CONFIG.CACHE_TIME;

const Stats = async () => {
  const allGroup = await getAllGroup();
  // Using optimized service layer function
  const groupStatByDept = await getOptimizedGroupTaskStats(allGroup);

  return (
    <>
      {groupStatByDept && groupStatByDept.length > 0 && (
        <StatsContainer groupStatByDept={groupStatByDept} />
      )}
    </>
  );
};

export default Stats;
