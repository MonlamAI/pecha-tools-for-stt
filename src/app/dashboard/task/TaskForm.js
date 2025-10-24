"use client";
import { createTasksFromCSV } from "@/model/task";
import React, { useState, useRef, useEffect } from "react";
import { useFormState } from "react-dom";
import Papa from "papaparse";
import Select from "@/components/Select";
import toast from "react-hot-toast";

const TaskForm = ({ groups }) => {
  const ref = useRef(null);
  const [selectedFile, setSelectedFile] = useState([]);
  const [selectedOption, setSelectedOption] = useState("");

  // Create a wrapper function for task creation
  const createTasksWrapper = async (formData) => {
    if (selectedFile.length > 1000) {
      return { error: "Please select a file with less than 1000 rows" };
    }
    const taskJson = JSON.stringify(selectedFile);
    formData.append("tasks", taskJson);
    const tasksCreated = await createTasksFromCSV(formData);

    if (tasksCreated?.count > 0) {
      return { success: "Tasks created successfully", count: tasksCreated.count };
    } else {
      return { error: "Error creating tasks" };
    }
  };

  // Initialize useFormState
  const [state, formAction] = useFormState(createTasksWrapper, null);

  // Handle Server Action results
  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    } else if (state?.success) {
      toast.success(state.success);
      // Reset form and clear selected file
      ref.current?.reset();
      setSelectedFile([]);
      setSelectedOption("");
    }
  }, [state]);

  const handleOptionChange = async (event) => {
    setSelectedOption(event.target.value);
  };

  const handleFileChange = (event) => {
    //  Passing file data (event.target.files[0]) to parse using Papa.parse
    Papa.parse(event.target.files[0], {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        console.log(results);
        setSelectedFile(results?.data);
      },
    });
  };


  return (
    <>
      <form
        ref={ref}
        action={formAction}
        className="flex flex-col md:flex-row justify-center items-center md:items-end pt-10 space-y-5 space-x-0 md:space-y-0 md:space-x-10"
      >
        <Select
          title="group_id"
          label="Group"
          options={groups}
          selectedOption={selectedOption}
          handleOptionChange={handleOptionChange}
        />
        <div className="form-control w-full max-w-xs">
          <label className="label" htmlFor="file_name">
            <span className="label-text text-base font-semibold">
              Choose a file (CSV only):
            </span>
          </label>
          <input
            id="file_name"
            name="file_name"
            accept=".csv"
            type="file"
            required
            className="file-input file-input-bordered file-input-accent max-w-xs"
            onChange={handleFileChange}
          />
        </div>
        <button
          type="submit"
          className="btn btn-accent"
        >
          Upload
        </button>
      </form>
    </>
  );
};

export default TaskForm;
