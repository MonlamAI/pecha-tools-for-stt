"use client";

import React, { useState, useEffect } from "react";
import TaskDashbooard from "./TaskDashbooard";
import { getAllGroup } from "@/model/group";

const Task = ({ searchParams }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const data = await getAllGroup();
        if (data && !data.error) {
          setGroups(data);
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
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
      <TaskDashbooard groups={groups} searchParams={searchParams} />
    </>
  );
};

export default Task;
