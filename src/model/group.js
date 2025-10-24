"use server";

import prisma from "@/service/db";
import { revalidatePath } from "next/cache";
export const getTranscribingcount = async (group_id) => {
  try {
    const taskCount = await prisma.group.findUnique({
      where: {
        id: group_id,
      },
      select: {
        name: true,
        _count: {
          select: {
            tasks: {
              where: {
                state: "transcribing",
                NOT: {
                  transcriber_id: null,
                },
              },
            },
          },
        },
      },
    });
    //  console.log('Debug - Task Count Result:', JSON.stringify(taskCount, null, 2));
    return taskCount;
  } catch (error) {
    console.error("Error fetching transcribing count:", error);
    return { error: "Failed to fetch transcribing count. Please try again." };
  }
};

export const getAllGroup = async () => {
  try {
    const allGroup = await prisma.group.findMany({
      include: {
        _count: {
          select: { tasks: true, users: true },
        },
        Department: true,
      },
      orderBy: {
        department_id: "asc",
      },
    });
    return allGroup;
  } catch (error) {
    console.error("Error getting all group:", error);
    return { error: "Failed to fetch groups. Please try again." };
  }
};

export const createGroup = async (prevState, formData) => {
  const groupName = formData.get("name")?.trim();
  const departmentId = formData.get("department_id");
  try {
    // guard: prevent duplicate group names within the same department
    const exists = await prisma.group.findFirst({
      where: { name: groupName, department_id: parseInt(departmentId) },
    });
    if (exists) {
      return { error: "Group with this name already exists in the department" };
    }
    const newGroup = await prisma.group.create({
      data: {
        name: groupName,
        department_id: parseInt(departmentId),
      },
    });
    revalidatePath("/dashboard/group");
    return { success: "Group created successfully", group: newGroup };
  } catch (error) {
    console.error("Error creating a group:", error);
    if (error?.code === "P2002") {
      return { error: "Group with this name already exists in the department" };
    }
    return { error: "Failed to create group. Please try again." };
  }
};

export const deleteGroup = async (id) => {
  try {
    const group = await prisma.group.delete({
      where: {
        id,
      },
    });
    revalidatePath("/dashboard/group");
    return { success: "Group deleted successfully" };
  } catch (error) {
    console.error("Error deleting a group:", error);
    return { error: "Failed to delete group. Please try again." };
  }
};

export const editGroup = async (id, formData) => {
  const groupName = formData.get("name")?.trim();
  const departmentId = formData.get("department_id");
  try {
    // guard: prevent duplicate on rename/move
    const exists = await prisma.group.findFirst({
      where: {
        name: groupName,
        department_id: parseInt(departmentId),
        NOT: { id },
      },
    });
    if (exists) {
      return { error: "Group with this name already exists in the department" };
    }
    const group = await prisma.group.update({
      where: {
        id,
      },
      data: {
        name: groupName,
        department_id: parseInt(departmentId),
      },
    });
    revalidatePath("/dashboard/group");
    return { success: "Group updated successfully", group };
  } catch (error) {
    console.error("Error updating a group:", error);
    if (error?.code === "P2002") {
      return { error: "Group with this name already exists in the department" };
    }
    return { error: "Failed to update group. Please try again." };
  }
};

export const getAllGroupTaskStats = async (groupList) => {
  // make a array of diff list of group  with diff department_id
  const groupStatsList = [];
  const taskStatsMain = await prisma.task.groupBy({
    by: ["state", "group_id"],
    where: {
      NOT: {
        state: "transcribing",
      },
    },
    _count: {
      _all: true,
    },
  });
  const taskImportedCount = await prisma.task.groupBy({
    by: ["group_id"],
    where: {
      state: "transcribing",
      transcriber_id: null,
    },
    _count: {
      _all: true,
    },
  });

  const taskTranscribingCount = await prisma.task.groupBy({
    by: ["group_id"],
    where: {
      state: "transcribing",
      NOT: {
        transcriber_id: null,
      },
    },
    _count: {
      _all: true,
    },
  });

  taskImportedCount.map((task) => {
    taskStatsMain.push({
      _count: {
        _all: task._count._all,
      },
      state: "imported",
      group_id: task.group_id,
    });
  });

  taskTranscribingCount.map((task) => {
    taskStatsMain.push({
      _count: {
        _all: task._count._all,
      },
      state: "transcribing",
      group_id: task.group_id,
    });
  });

  for (let group of groupList) {
    const { id, name, department_id } = group;
    const departmentName = group.Department?.name;
    const taskStatsCount = taskStatsMain.filter((task) => task.group_id === id);
    // console.log("importedTaskCount:", taskStatsCount);
    try {
      // get the count of tasks imported for each group
      const groupStats = {
        id,
        name,
        department_id,
        departmentName,
        taskImportedCount:
          taskStatsCount.find((stats) => stats.state === "imported")?._count
            ?._all ?? 0,
        taskTranscribingCount:
          taskStatsCount.find((stats) => stats.state === "transcribing")?._count
            ?._all ?? 0,
        taskSubmittedCount:
          taskStatsCount.find((stats) => stats.state === "submitted")?._count
            ?._all ?? 0,
        taskAcceptedCount:
          taskStatsCount.find((stats) => stats.state === "accepted")?._count
            ?._all ?? 0,
        taskFinalisedCount:
          taskStatsCount.find((stats) => stats.state === "finalised")?._count
            ?._all ?? 0,
        taskTrashedCount:
          taskStatsCount.find((stats) => stats.state === "trashed")?._count
            ?._all ?? 0,
      };
      groupStatsList.push(groupStats);
    } catch (error) {
      console.error("Error getting all groups task stats:", error);
      return { error: "Failed to fetch group task statistics. Please try again." };
    }
  }
  const groupedByDepartment = groupByDepartmentId(groupStatsList);
  return groupedByDepartment;
};

function groupByDepartmentId(arr) {
  const grouped = {};

  arr.forEach((obj) => {
    const { department_id } = obj;

    if (!grouped[department_id]) {
      grouped[department_id] = [];
    }

    grouped[department_id].push(obj);
  });

  return Object.values(grouped);
}
