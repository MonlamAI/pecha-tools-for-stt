"use client";
import React, { useRef, useState, useEffect } from "react";
import { editUserByForm } from "@/model/user";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import Select from "@/components/Select";
import toast from "react-hot-toast";

const EditUserModal = ({ groups, selectedRow }) => {
  // console.log("EditUserModal: ", { groups, selectedRow });
  const ref = useRef(null);
  const [groupId, setGroupId] = useState("");
  const [role, setRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();
  const [state, formAction] = useFormState(editUserByForm, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) {
      toast.success(state.success);
      ref.current?.reset();
      router.refresh();
      window.edit_modal.close();
    }
  }, [state, router]);


  const handleInputChange = (event) => {
    const inputValue = event.target.value?.trim();
    setUsername(inputValue);
    // Use a regex to check for valid username format (no spaces or slashes)
    // if (/^[A-Za-z0-9_-]*$/.test(inputValue)) {  // no email id accepted for username
    if (/^[A-Za-z0-9_.@-]*$/.test(inputValue)) {
      // email id accepted for username
      setError("");
    } else {
      setError(
        "Invalid username format (no spaces or slashes allowed or special characters)"
      );
    }
  };

  useEffect(() => {
    let isMounted = true;
    const userGroupId = selectedRow?.group_id;
    const userRole = selectedRow?.role;
    const name = selectedRow?.name;
    if (selectedRow !== null) {
      setGroupId(userGroupId);
      setRole(userRole);
      setUsername(name);
      setIsLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [selectedRow]);

  const handleGroupChange = async (event) => {
    setGroupId(event.target.value);
  };

  const handleRoleChange = async (event) => {
    setRole(event.target.value);
  };

  const roles = [
    {
      id: "TRANSCRIBER",
      name: "Transcriber",
    },
    {
      name: "Reviewer",
      id: "REVIEWER",
    },
    {
      name: "Final Reviewer",
      id: "FINAL_REVIEWER",
    },
  ];

  return (
    <>
      <dialog id="edit_modal" className="modal">
        {isLoading ? (
          <div className="flex min-h-screen flex-col justify-center items-center">
            <h1 className="font-bold text-3xl">loading...</h1>
          </div>
        ) : (
          <form ref={ref} action={formAction} className="modal-box w-4/5 max-w-2xl">
            <input type="hidden" name="id" value={selectedRow?.id} readOnly />
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Edit User</h3>
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
                  <span className="label-text text-base font-semibold ">
                    Id
                  </span>
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
                    Username
                  </span>
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="username"
                  required
                  className="input input-bordered w-full"
                  value={username}
                  onChange={handleInputChange}
                />
                {error && (
                  <label className="label">
                    <span className="label-text-alt text-red-500">{error}</span>
                  </label>
                )}
              </div>
              <div>
                <label className="label" htmlFor="email">
                  <span className="label-text text-base font-semibold ">
                    Email
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="email"
                  required
                  className="input input-bordered w-full"
                  defaultValue={selectedRow?.email}
                />
              </div>
              <Select
                title="group_id"
                label="Group"
                options={groups}
                selectedOption={groupId}
                handleOptionChange={handleGroupChange}
              />
              <Select
                title="role"
                label="Role"
                options={roles}
                selectedOption={role}
                handleOptionChange={handleRoleChange}
              />
            </div>
            <button
              type="submit"
              disabled={error}
              className="btn btn-accent w-full sm:w-1/5 my-4 py-1 px-6 capitalize"
            >
              update
            </button>
          </form>
        )}
      </dialog>
    </>
  );
};

export default EditUserModal;
