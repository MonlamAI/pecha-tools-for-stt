"use client";

import React, { useState, useEffect, useCallback } from "react";
import UserDashboard from "./UserDashboard";
import { getAllUser } from "@/model/user";
import { getAllGroup } from "@/model/group";

const User = ({ searchParams }) => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [usersData, groupsData] = await Promise.all([
        getAllUser(),
        getAllGroup()
      ]);

      if (usersData && !usersData.error) setUsers(usersData);
      if (groupsData && !groupsData.error) setGroups(groupsData);
    } catch (error) {
      console.error("Error fetching user/group data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <>
      <UserDashboard
        users={users}
        groups={groups}
        searchParams={searchParams}
        onDone={fetchData}
      />
    </>
  );
};

export default User;
