"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { createGroup } from "@/model/group";
import Select from "@/components/Select";
import toast from "react-hot-toast";

const AddGroupModal = ({ departments }) => {
  const [departmentId, setDepartmentId] = useState("");
  const ref = useRef(null);
  const router = useRouter();

  // Initialize useFormState with createGroup
  const [state, formAction] = useFormState(createGroup, null);

  // Handle Server Action results
  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    } else if (state?.success) {
      toast.success(state.success);
      // Reset form and close modal
      ref.current?.reset();
      setDepartmentId("");
      router.refresh();
      window.add_modal.close();
    }
  }, [state]);

  const handleDepartmentChange = async (event) => {
    setDepartmentId(event.target.value);
  };
  return (
    <>
      <dialog id="add_modal" className="modal">
        <form ref={ref} action={formAction} className="modal-box">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Create Group</h3>
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={(e) => {
                e.preventDefault();
                ref.current?.reset();
                window.add_modal.close();
              }}
            >
              ✕
            </button>
          </div>
          <div className="form-control grid gap-4 mb-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                <span className="label-text text-base font-semibold ">
                  Group Name
                </span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Enter group name"
                required
                className="input input-bordered w-full"
              />
            </div>
            <Select
              title="department_id"
              label="Department"
              options={departments}
              selectedOption={departmentId}
              handleOptionChange={handleDepartmentChange}
            />
          </div>
          <button
            type="submit"
            className="btn btn-accent w-full sm:w-1/5 my-4 py-1 px-6 capitalize"
          >
            create
          </button>
        </form>
      </dialog>
    </>
  );
};

export default AddGroupModal;
