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


const UserDashboard = ({ users, groups, searchParams }) => {
  // console.log("UserDashboard:", { users, groups });
  const [selectedRow, setSelectedRow] = useState(null);
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

  return (
    <>
      <div className="my-10 flex justify-center">
        <DashboardBtn
          label="Create"
          icon={<AiOutlinePlus />}
          onClick={() => window.add_modal.showModal()}
        />
      </div>
      <div className="flex justify-center items-center my-10">
        <div className="relative overflow-x-auto shadow-md sm:rounded-lg w-11/12 md:w-4/5 max-h-[80vh]">
          <table className="table">
            <thead className="text-xs md:text-base uppercase ">
              <tr>
                <th className="px-6 py-3">User Id</th>
                <th className="px-6 py-3">Group Id</th>
                <th className="px-6 py-3">Group Name</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="text-sm md:text-base">
                  <th className="px-6 py-4">{user.id}</th>
                  <td className="px-6 py-4">{user.group_id}</td>
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
                <DeleteUserButton userId={user.id} userName={user.name} onDone={() => router.refresh()} />
                    {/* <a
                      href="#"
                      className="font-medium text-error hover:underline"
                      onClick={() => handleRemoveUser(user)}
                    >
                      Remove
                    </a> */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddUserModal groups={groups} />
        <EditUserModal groups={groups} selectedRow={selectedRow} />
      </div>
    </>
  );
};

export default UserDashboard;

function DeleteUserButton({ userId, userName, onDone }) {
  const [state, formAction] = useFormState(deleteUserByForm, null);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) {
      toast.success(state.success);
      onDone?.();
    }
  }, [state]);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Are you sure you want to delete user "${userName}" (ID: ${userId})? This action cannot be undone.`
        );
        if (!ok) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={userId} readOnly />
      <button className="font-medium text-error hover:underline">Remove</button>
    </form>
  );
}
