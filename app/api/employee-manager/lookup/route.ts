import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch active departments (type codes: HTCPP, DEP, DEPT or by type name)
    let deptTypeIds: number[] = [];
    const deptTypes = await prisma.common_type.findMany({
      where: {
        OR: [
          { TYP_CD: { in: ["HTCPP", "DEP", "DEPT", "DEPARTMENT"] } },
          { TYP_NM: { contains: "Department", mode: "insensitive" } },
        ],
      },
      select: { TYP_ID: true },
    });
    deptTypeIds = deptTypes.map((t) => t.TYP_ID);

    let departments = deptTypeIds.length > 0
      ? await prisma.independent_mst.findMany({
          where: {
            TYP_ID: { in: deptTypeIds },
            OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
          },
          select: { MSTR_ID: true, MSTR_NM: true },
          orderBy: { MSTR_NM: "asc" },
        })
      : [];

    // Fallback: If no departments found by type, fetch from independent_mst for any department-like names or referenced DEPARTMENT IDs
    if (departments.length === 0) {
      const distinctDeptEmployees = await prisma.emp_mst.findMany({
        where: { DEPARTMENT: { not: null }, IS_DELETED: 0 },
        select: { DEPARTMENT: true },
        distinct: ["DEPARTMENT"],
      });
      const deptIds = distinctDeptEmployees.map((e) => e.DEPARTMENT!).filter(Boolean);
      if (deptIds.length > 0) {
        departments = await prisma.independent_mst.findMany({
          where: { MSTR_ID: { in: deptIds } },
          select: { MSTR_ID: true, MSTR_NM: true },
          orderBy: { MSTR_NM: "asc" },
        });
      }
    }

    const formattedDepartments = departments.map((d) => ({
      label: d.MSTR_NM,
      value: String(d.MSTR_ID),
    }));

    // 2. Fetch employee statuses (type codes: ES, EMP_STATUS or by name)
    let statusTypeIds: number[] = [];
    const statusTypes = await prisma.common_type.findMany({
      where: {
        OR: [
          { TYP_CD: { in: ["ES", "EMP_STATUS", "STATUS"] } },
          { TYP_NM: { contains: "Status", mode: "insensitive" } },
        ],
      },
      select: { TYP_ID: true },
    });
    statusTypeIds = statusTypes.map((t) => t.TYP_ID);

    let statuses = statusTypeIds.length > 0
      ? await prisma.independent_mst.findMany({
          where: {
            TYP_ID: { in: statusTypeIds },
            OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
          },
          select: { MSTR_ID: true, MSTR_NM: true },
          orderBy: { MSTR_NM: "asc" },
        })
      : [];

    // Fallback: If no statuses found by type, fetch distinct EMP_STATUS_IDs from emp_mst
    if (statuses.length === 0) {
      const distinctStatusEmployees = await prisma.emp_mst.findMany({
        where: { EMP_STATUS_ID: { not: null }, IS_DELETED: 0 },
        select: { EMP_STATUS_ID: true },
        distinct: ["EMP_STATUS_ID"],
      });
      const statusIds = distinctStatusEmployees.map((e) => e.EMP_STATUS_ID!).filter(Boolean);
      if (statusIds.length > 0) {
        statuses = await prisma.independent_mst.findMany({
          where: { MSTR_ID: { in: statusIds } },
          select: { MSTR_ID: true, MSTR_NM: true },
          orderBy: { MSTR_NM: "asc" },
        });
      }
    }

    const formattedStatuses = statuses.map((s) => ({
      label: s.MSTR_NM,
      value: String(s.MSTR_ID),
    }));

    // 3. Fetch active managers
    const managers = await prisma.emp_mst.findMany({
      where: {
        IS_DELETED: 0,
        OR: [
          { IS_MANAGER: "1" },
          { IS_MANAGER: "Yes" },
          { IS_MANAGER: "yes" },
        ],
      },
      select: {
        EMP_ID: true,
        EMP_NAME: true,
        EMP_MIDDLE_NM: true,
        EMPLST_NM: true,
      },
      orderBy: {
        EMP_NAME: "asc",
      },
    });

    let managerList = managers;
    if (managerList.length === 0) {
      // Fallback to all employees who have a non-empty name
      managerList = await prisma.emp_mst.findMany({
        where: { IS_DELETED: 0 },
        select: {
          EMP_ID: true,
          EMP_NAME: true,
          EMP_MIDDLE_NM: true,
          EMPLST_NM: true,
        },
        orderBy: { EMP_NAME: "asc" },
        take: 100,
      });
    }

    const formattedManagers = managerList.map((m) => {
      const middleName = m.EMP_MIDDLE_NM ? ` ${m.EMP_MIDDLE_NM}` : "";
      const lastName = m.EMPLST_NM ? ` ${m.EMPLST_NM}` : "";
      const fullName = `${m.EMP_NAME || ""}${middleName}${lastName}`.trim();
      return {
        label: fullName || `Employee #${m.EMP_ID}`,
        value: String(m.EMP_ID),
      };
    });

    return NextResponse.json({
      success: true,
      departments: formattedDepartments,
      statuses: formattedStatuses,
      managers: formattedManagers,
    });
  } catch (error) {
    console.error("Employee lookups API failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch lookup data." },
      { status: 500 }
    );
  }
}
