"use server";

import { revalidatePath } from "next/cache";
import prisma from "./db";
type StatRow = { group_id: number; state: string; _count: { _all: number } };

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
    // Aggregate once across all groups, then project per group
    const taskStatsMain = (await prisma.task.groupBy({
      by: ["state", "group_id"],
      where: { NOT: { state: "transcribing" } },
      _count: { _all: true },
    })) as StatRow[];

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

    for (const t of taskImportedCount) {
      taskStatsMain.push({
        group_id: t.group_id,
        // pseudo-state for imported
        state: "imported",
        _count: { _all: t._count._all },
      } as StatRow);
    }
    for (const t of taskTranscribingCount) {
      taskStatsMain.push({
        group_id: t.group_id,
        state: "transcribing",
        _count: { _all: t._count._all },
      } as StatRow);
    }

    const out = [] as any[];
    for (const group of groupList) {
      const bucket = taskStatsMain.filter((t) => t.group_id === group.id);
      out.push({
        id: group.id,
        name: group.name,
        department_id: group.department_id,
        departmentName: group.Department?.name,
        taskImportedCount:
          bucket.find((b) => b.state === "imported")?._count?._all ?? 0,
        taskTranscribingCount:
          bucket.find((b) => b.state === "transcribing")?._count?._all ?? 0,
        taskSubmittedCount:
          bucket.find((b) => b.state === "submitted")?._count?._all ?? 0,
        taskAcceptedCount:
          bucket.find((b) => b.state === "accepted")?._count?._all ?? 0,
        taskFinalisedCount:
          bucket.find((b) => b.state === "finalised")?._count?._all ?? 0,
        taskTrashedCount:
          bucket.find((b) => b.state === "trashed")?._count?._all ?? 0,
      });
    }

    return groupByDepartmentId(out);
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
