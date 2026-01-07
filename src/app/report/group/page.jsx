"use client";

import React, { useState, useEffect, Suspense } from "react";
import { getAllGroup } from "@/model/group";
import GroupReport from "./GroupReport";

const Group = () => {
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

    return <GroupReport groups={groups} />;
};

export default Group;