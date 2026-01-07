"use client";

import React, { useState, useEffect } from "react";
import { getAllUser } from "@/model/user";
import UserReport from "./UserReport";

const User = ({ searchParams, params }) => {
  const { id } = params;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await getAllUser();
        if (data && !data.error) {
          setUsers(data);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return <UserReport id={id} users={users} searchParams={searchParams} />;
};

export default User;
