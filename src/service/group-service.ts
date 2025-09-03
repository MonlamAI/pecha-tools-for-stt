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

// export async function getAllGroupTaskStats(groupList: any[]) {
//   const taskStatsMain = await prisma.task.groupBy({
//     by: ["state", "group_id"],
//     _count: { _all: true },
//   });

//   const groupStatsList = groupList.map((group) =>
//     mapTaskStats(group, taskStatsMain)
//   );

//   return groupByDepartmentId(groupStatsList);
// }
