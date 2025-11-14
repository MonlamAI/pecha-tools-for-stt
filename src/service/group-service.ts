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
    // Collapse per-group counts into aggregated grouped queries
    const taskStatsMain = await prisma.task.groupBy({
      by: ["state", "group_id"],
      where: { NOT: { state: "transcribing" } },
      _count: { _all: true },
    });

    const taskImportedCount = await prisma.task.groupBy({
      by: ["group_id"],
      where: { state: "transcribing", transcriber_id: null },
      _count: { _all: true },
    });

    const taskTranscribingCount = await prisma.task.groupBy({
      by: ["group_id"],
      where: { state: "transcribing", NOT: { transcriber_id: null } },
      _count: { _all: true },
    });

    const merged = [
      ...taskStatsMain,
      ...taskImportedCount.map((t: any) => ({
        state: "imported",
        group_id: t.group_id,
        _count: { _all: t._count._all },
      })),
      ...taskTranscribingCount.map((t: any) => ({
        state: "transcribing",
        group_id: t.group_id,
        _count: { _all: t._count._all },
      })),
    ];

    const groupStatsList = groupList.map((group: any) => {
      const taskStatsCount = merged.filter((t) => t.group_id === group.id);
      return {
        id: group.id,
        name: group.name,
        department_id: group.department_id,
        departmentName: group.Department?.name,
        taskImportedCount:
          taskStatsCount.find((s) => s.state === "imported")?._count?._all ?? 0,
        taskTranscribingCount:
          taskStatsCount.find((s) => s.state === "transcribing")?._count?._all ?? 0,
        taskSubmittedCount:
          taskStatsCount.find((s) => s.state === "submitted")?._count?._all ?? 0,
        taskAcceptedCount:
          taskStatsCount.find((s) => s.state === "accepted")?._count?._all ?? 0,
        taskFinalisedCount:
          taskStatsCount.find((s) => s.state === "finalised")?._count?._all ?? 0,
        taskTrashedCount:
          taskStatsCount.find((s) => s.state === "trashed")?._count?._all ?? 0,
      };
    });

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
