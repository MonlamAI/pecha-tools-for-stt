"use client";

import React, { useState, useEffect } from "react";
import { AiOutlinePlus } from "react-icons/ai";
import DashboardBtn from "@/components/DashboardBtn";
import AddUserModal from "./AddUserModal";
import { deleteUserByForm } from "@/model/user";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import EditUserModal from "./EditUserModal";
import toast from "react-hot-toast";


const UserDashboard = ({ users, groups, searchParams, onDone }) => {
  // console.log("UserDashboard:", { users, groups });
  const [selectedRow, setSelectedRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const router = useRouter();

  // Handle Server Action results from URL params
  useEffect(() => {
    if (searchParams?.success) {
      toast.success(searchParams.success);
    } else if (searchParams?.error) {
      toast.error(searchParams.error);
    }
  }, [searchParams]);

  const handleEditUser = (userRow) => {
    setSelectedRow(userRow);
    window.edit_modal.showModal();
  };

  // ---------------- FILTER LOGIC ----------------
  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup =
      !selectedGroupId || user.group_id === Number(selectedGroupId);

    return matchesSearch && matchesGroup;
  });

  return (
    <>
      <div className="my-3 flex flex-col md:flex-row items-center justify-center gap-4 px-4">
        {/* Search Input */}
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search name or email..."
            className="input input-bordered w-full h-10 rounded-xl dark:bg-[#222426] dark:border-neutral-700 dark:text-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Group Filter */}
        <div className="flex-1 max-w-sm">
          <select
            className="select select-bordered w-full h-10 min-h-0 rounded-xl dark:bg-[#222426] dark:border-neutral-700 dark:text-gray-200"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            <option value="">All Groups</option>
            {groups?.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {/* Create Button */}
        <DashboardBtn
          label="Create"
          icon={<AiOutlinePlus />}
          onClick={() => window.add_modal.showModal()}
        />
      </div>

      <div className="flex justify-center items-center my-3 px-4">
        <div className="card bg-base-100 dark:bg-[#222426] border dark:border-none rounded-2xl p-2 w-full px-4 overflow-x-auto max-h-[80vh]">
          <table className="table">
            <thead className="text-xs md:text-base uppercase bg-base-200 dark:bg-[#222426] dark:text-gray-200">
              <tr>
                <th className="px-2 py-3 bg-base-200 dark:bg-[#222426]">User Id</th>
                <th className="px-2 py-3 bg-base-200 dark:bg-[#222426]">Group Id</th>
                <th className="px-6 py-3 bg-base-200 dark:bg-[#222426]">Group Name</th>
                <th className="px-6 py-3 bg-base-200 dark:bg-[#222426]">Name</th>
                <th className="px-6 py-3 bg-base-200 dark:bg-[#222426]">Email</th>
                <th className="px-6 py-3 bg-base-200 dark:bg-[#222426]">Role</th>
                <th className="px-6 py-3 bg-base-200 dark:bg-[#222426]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers?.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="text-sm md:text-base">
                    <th className="px-2 py-4">{user.id}</th>
                    <td className="px-2 py-4">{user.group_id}</td>
                    <td className="px-6 py-4">{user.group?.name}</td>
                    <td className="px-6 py-4">{user.name}</td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">{user.role}</td>
                    <td className="flex items-center px-6 py-4 space-x-3">
                      <button
                        type="button"
                        className="font-medium text-info hover:underline"
                        onClick={() => handleEditUser(user)}
                      >
                        Edit
                      </button>
                      <DeleteUserButton userId={user.id} onDone={onDone} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 opacity-50">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AddUserModal groups={groups} onDone={onDone} />
        <EditUserModal groups={groups} selectedRow={selectedRow} onDone={onDone} />
      </div>
    </>
  );
};

export default UserDashboard;

function DeleteUserButton({ userId, onDone }) {
  const [state, formAction] = useFormState(deleteUserByForm, null);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) {
      toast.success(state.success);
      onDone?.();
    }
  }, [state]);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={userId} readOnly />
      <button className="font-medium text-error hover:underline">Remove</button>
    </form>
  );
}
