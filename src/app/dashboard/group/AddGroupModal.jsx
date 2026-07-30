"use client";

import React, { useRef, useState, useEffect } from "react";
import { useFormState } from "react-dom";
import { createGroup } from "@/model/group";
import Select from "@/components/Select";
import toast from "react-hot-toast";
import { PAY_CATEGORIES } from "@/constants/payCategories";

const AddGroupModal = ({ departments, onDone }) => {
  const [departmentId, setDepartmentId] = useState("");
  const [payCategory, setPayCategory] = useState("");
  const ref = useRef(null);

  const [state, formAction] = useFormState(createGroup, null);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    } else if (state?.success) {
      toast.success(state.success);
      ref.current?.reset();
      setDepartmentId("");
      setPayCategory("");
      onDone?.();
      window.add_modal.close();
    }
  }, [state, onDone]);

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
                setDepartmentId("");
                setPayCategory("");
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
              handleOptionChange={(e) => setDepartmentId(e.target.value)}
            />
            <Select
              title="pay_category"
              label="Pay Category"
              options={PAY_CATEGORIES}
              selectedOption={payCategory}
              handleOptionChange={(e) => setPayCategory(e.target.value)}
            />
          </div>
          {payCategory && (
            <p className="text-sm text-base-content/70 -mt-2 mb-2">
              {
                PAY_CATEGORIES.find((c) => c.id === payCategory)
                  ?.description
              }
            </p>
          )}
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
