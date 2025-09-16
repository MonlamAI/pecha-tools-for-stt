"use server";

import { revalidatePath } from "next/cache";
import prisma from "./db";

export async function getTranscribingCount({ groupId }: { groupId: number }) {
  return await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      name: true,
      _count: {
        select: {
          tasks: {
            where: {
              state: "transcribing",
              NOT: { transcriber_id: null },
            },
          },
        },
      },
    },
  });
}

// export async function getAllGroups() {
//   return prisma.group.findMany({
//     include: {
//       _count: { select: { tasks: true, users: true } },
//       Department: true,
//     },
//     orderBy: { department_id: "asc" },
//   });
// }
// export async function createGroup(formData: FormData) {
//   const name = formData.get("name")?.toString().trim();
//   const departmentId = Number(formData.get("department_id"));
//   const newGroup = await prisma.group.create({
//     data: { name, department_id: departmentId },
//   });
//   revalidatePath("/dashboard/group");
//   return newGroup;
// }

// export async function deleteGroup(id: number) {
//   const group = await prisma.group.delete({ where: { id } });
//   revalidatePath("/dashboard/group");
//   return group;
// }

// export async function editGroup(id: number, formData: FormData) {
//   const name = formData.get("name")?.toString().trim();
//   const departmentId = Number(formData.get("department_id"));
//   const group = await prisma.group.update({
//     where: { id },
//     data: { name, department_id: departmentId },
//   });
//   revalidatePath("/dashboard/group");
//   return group;
// }

export async function getAllGroupTaskStats(groupList: any[]) {
  if (!groupList || groupList.length === 0) return [];

  try {
    // Optimized concurrent queries using Promise.all pattern
    const groupPromises = groupList.map(async (group) => {
      const [importedTasks, transcribingTasks, submittedTasks, acceptedTasks, finalisedTasks, trashedTasks] = await Promise.all([
        // Tasks in "transcribing" state with no transcriber (imported)
        prisma.task.count({
          where: {
            group_id: group.id,
            state: "transcribing",
            transcriber_id: null,
          },
        }),

        // Tasks in "transcribing" state with transcriber assigned
        prisma.task.count({
          where: {
            group_id: group.id,
            state: "transcribing",
            transcriber_id: { not: null },
          },
        }),

        // Tasks in other states
        prisma.task.count({
          where: {
            group_id: group.id,
            state: "submitted",
          },
        }),

        prisma.task.count({
          where: {
            group_id: group.id,
            state: "accepted",
          },
        }),

        prisma.task.count({
          where: {
            group_id: group.id,
            state: "finalised",
          },
        }),

        prisma.task.count({
          where: {
            group_id: group.id,
            state: "trashed",
          },
        }),
      ]);

      return {
        id: group.id,
        name: group.name,
        department_id: group.department_id,
        departmentName: group.Department?.name,
        taskImportedCount: importedTasks,
        taskTranscribingCount: transcribingTasks,
        taskSubmittedCount: submittedTasks,
        taskAcceptedCount: acceptedTasks,
        taskFinalisedCount: finalisedTasks,
        taskTrashedCount: trashedTasks,
      };
    });

    const groupStatsList = await Promise.all(groupPromises);
    return groupByDepartmentId(groupStatsList);
  } catch (error) {
    console.error("Error getting all groups task stats:", error);
    return { error: "Failed to fetch group task statistics. Please try again." };
  }
}

// Helper function for grouping by department
function groupByDepartmentId(arr: any[]) {
  const grouped: { [key: number]: any[] } = {};

  arr.forEach((obj) => {
    const { department_id } = obj;

    if (!grouped[department_id]) {
      grouped[department_id] = [];
    }

    grouped[department_id].push(obj);
  });

  return Object.values(grouped);
}
