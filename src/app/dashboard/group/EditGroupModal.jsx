"use client";
import React, { useRef, useState, useEffect } from "react";
import { useFormState } from "react-dom";
import { editGroup } from "@/model/group";
import Select from "@/components/Select";
import toast from "react-hot-toast";
import { PAY_CATEGORIES } from "@/constants/payCategories";

const EditGroupModal = ({ selectedRow, departments, onDone }) => {
  const ref = useRef(null);
  const [departmentId, setDepartmentId] = useState("");
  const [payCategory, setPayCategory] = useState("");

  const editGroupWithId = (prevState, formData) => {
    if (selectedRow?.id) {
      return editGroup(selectedRow.id, formData);
    }
    return { error: "No group selected" };
  };

  const [state, formAction] = useFormState(editGroupWithId, null);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    } else if (state?.success) {
      toast.success(state.success);
      onDone?.();
      window.edit_modal.close();
    }
  }, [state, onDone]);

  useEffect(() => {
    if (selectedRow?.Department !== null) {
      setDepartmentId(selectedRow?.Department?.id);
    }
    setPayCategory(selectedRow?.pay_category || "");
  }, [selectedRow]);

  return (
    <>
      <dialog id="edit_modal" className="modal ">
        <form ref={ref} action={formAction} className="modal-box w-4/5 max-w-2xl  ">
          <input type="hidden" name="id" value={selectedRow?.id} readOnly />
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Edit Group</h3>
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={(e) => {
                e.preventDefault();
                ref.current?.reset();
                window.edit_modal.close();
              }}
            >
              ✕
            </button>
          </div>
          <div className="form-control grid gap-4 mb-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="id">
                <span className="label-text text-base font-semibold ">Id</span>
              </label>
              <input
                id="id"
                type="text"
                name="id"
                disabled
                required
                className="input input-bordered w-full"
                defaultValue={selectedRow?.id}
              />
            </div>
            <div>
              <label className="label" htmlFor="name">
                <span className="label-text text-base font-semibold ">
                  Name
                </span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="name"
                required
                defaultValue={selectedRow?.name}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label" htmlFor="users">
                <span className="label-text text-base font-semibold ">
                  No. Users
                </span>
              </label>
              <input
                id="users"
                type="text"
                name="users"
                disabled
                required
                className="input input-bordered w-full"
                defaultValue={selectedRow?._count.users}
              />
            </div>
            <div>
              <label className="label" htmlFor="tasks">
                <span className="label-text text-base font-semibold ">
                  No. Tasks
                </span>
              </label>
              <input
                id="tasks"
                type="text"
                name="tasks"
                required
                disabled
                defaultValue={selectedRow?._count.tasks}
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
            update
          </button>
        </form>
      </dialog>
    </>
  );
};

export default EditGroupModal;
