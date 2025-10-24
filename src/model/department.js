"use server";

import prisma from "@/service/db";
import { revalidatePath } from "next/cache";

export const getAllDepartment = async () => {
  try {
    const allDepartment = await prisma.department.findMany({
      include: {
        _count: {
          select: { groups: true },
        },
        groups: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return allDepartment;
  } catch (error) {
    console.error("Error getting all Department:", error);
    return { error: "Failed to fetch departments. Please try again." };
  }
};

export const createDepartment = async (prevState, formData) => {
  const departmentName = formData.get("name")?.trim();
  try {
    // guard: prevent duplicate department names
    const exists = await prisma.department.findFirst({ where: { name: departmentName } });
    if (exists) {
      return { error: "Department already exists" };
    }
    const newDepartment = await prisma.department.create({
      data: {
        name: departmentName,
      },
    });
    revalidatePath("/dashboard/department");
    return { success: "Department created successfully", department: newDepartment };
  } catch (error) {
    console.error("Error creating a department:", error);
    if (error?.code === "P2002") {
      return { error: "Department already exists" };
    }
    return { error: "Failed to create department. Please try again." };
  }
};

export const deleteDepartment = async (id) => {
  try {
    const department = await prisma.department.delete({
      where: {
        id,
      },
    });
    revalidatePath("/dashboard/department");
    return { success: "Department deleted successfully" };
  } catch (error) {
    console.error("Error deleting a department:", error);
    return { error: "Failed to delete department. Please try again." };
  }
};

export const editDepartment = async (id, formData) => {
  const departmentName = formData.get("name")?.trim();
  try {
    // guard: prevent duplicate on rename
    const exists = await prisma.department.findFirst({ where: { name: departmentName, NOT: { id } } });
    if (exists) {
      return { error: "Department already exists" };
    }
    const department = await prisma.department.update({
      where: {
        id,
      },
      data: {
        name: departmentName,
      },
    });
    revalidatePath("/dashboard/department");
    return { success: "Department updated successfully", department };
  } catch (error) {
    console.error("Error updating a department:", error);
    if (error?.code === "P2002") {
      return { error: "Department already exists" };
    }
    return { error: "Failed to update department. Please try again." };
  }
};
