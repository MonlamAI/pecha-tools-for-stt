"use client";

import React, { useRef, useEffect } from "react";
import { useFormState } from "react-dom";
import { createDepartment } from "@/model/department";
import toast from "react-hot-toast";

const AddDepartmentModal = () => {
  const ref = useRef(null);

  // Initialize useFormState with createDepartment
  const [state, formAction] = useFormState(createDepartment, null);

  // Handle Server Action results
  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    } else if (state?.success) {
      toast.success(state.success);
      // Reset form and close modal
      ref.current?.reset();
      window.add_modal.close();
    }
  }, [state]);
  return (
    <>
      <dialog id="add_modal" className="modal">
        <form ref={ref} action={formAction} className="modal-box">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Create Department</h3>
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
          <div className="form-control w-full sm:w-3/4">
            <label className="label" htmlFor="name">
              <span className="label-text text-base font-semibold ">
                Dept Name
              </span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="Enter department name"
              required
              className="input input-bordered"
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

export default AddDepartmentModal;
