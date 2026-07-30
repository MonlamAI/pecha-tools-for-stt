"use client";

import DashboardBtn from "@/components/DashboardBtn";
import React, { useState } from "react";
import { AiOutlinePlus } from "react-icons/ai";
import AddGroupModal from "./AddGroupModal";
import EditGroupModal from "./EditGroupModal";
import { deleteGroup, setGroupNotificationEnabled } from "@/model/group";
import { PAY_CATEGORY_LABELS } from "@/constants/payCategories";
import toast from "react-hot-toast";

const GroupDashboard = ({ groupList, departments, onDone }) => {
  // console.log({ groupList, departments });
  const [selectedRow, setSelectedRow] = useState(null);
  // [Reason] Track which group toggle is saving so only that row is disabled
  const [togglingGroupId, setTogglingGroupId] = useState(null);

  const handleRemoveGroup = async (row) => {
    const noUser = row._count.users;
    const noTask = row._count.tasks;
    if (noUser !== 0 || noTask !== 0) {
      window.alert(
        `Group ${row.name} has ${noUser} users and ${noTask} tasks!`
      );
    } else {
      const deletedGroup = await deleteGroup(row.id);
      onDone?.();
    }
  };

  const handleEditGroup = async (row) => {
    setSelectedRow(row);
    window.edit_modal.showModal();
  };

  // [Reason] Persist Slack notification flag immediately when the admin toggles it
  const handleNotificationToggle = async (row, enabled) => {
    setTogglingGroupId(row.id);
    try {
      const result = await setGroupNotificationEnabled(row.id, enabled);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result?.success ||
          (enabled ? "Slack notifications enabled" : "Slack notifications disabled")
      );
      await onDone?.();
    } catch (error) {
      console.error("Failed to update notification setting:", error);
      toast.error("Failed to update notification setting");
    } finally {
      setTogglingGroupId(null);
    }
  };

  return (
    <div>
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
            <thead className="text-xs md:text-base uppercase">
              <tr>
                <th className="px-6 py-3">Id</th>
                <th className="px-6 py-3">Group name</th>
                <th className="px-6 py-3">Pay category</th>
                <th className="px-6 py-3">Department name</th>
                <th className="px-6 py-3">No. Users</th>
                <th className="px-6 py-3">No. Tasks</th>
                <th className="px-6 py-3">Slack Notifications</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {groupList?.map((row) => (
                <tr className="text-sm md:text-base" key={row.id}>
                  <th className="px-6 py-4">{row.id}</th>
                  <td className="px-6 py-4">{row.name}</td>
                  <td className="px-6 py-4">
                    {PAY_CATEGORY_LABELS[row.pay_category] || row.pay_category || "—"}
                  </td>
                  <td className="px-6 py-4">{row.Department?.name}</td>
                  <td className="px-6 py-4">{row._count.users || 0}</td>
                  <td className="px-6 py-4">{row._count.tasks || 0}</td>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="toggle toggle-success"
                      checked={Boolean(row.notification_enabled)}
                      disabled={togglingGroupId === row.id}
                      aria-label={`Toggle Slack notifications for ${row.name}`}
                      onChange={(e) =>
                        handleNotificationToggle(row, e.target.checked)
                      }
                    />
                  </td>
                  <td className="flex items-center px-6 py-4 space-x-3">
                    <button
                      type="button"
                      className="font-medium text-info hover:underline"
                      onClick={() => handleEditGroup(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="font-medium text-error hover:underline"
                      onClick={() => handleRemoveGroup(row)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AddGroupModal departments={departments} onDone={onDone} />
      <EditGroupModal selectedRow={selectedRow} departments={departments} onDone={onDone} />
    </div>
  );
};

export default GroupDashboard;
