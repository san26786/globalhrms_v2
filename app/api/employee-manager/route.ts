import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const department = searchParams.get("department") || "";
    const manager = searchParams.get("manager") || "";

    // Build Prisma query condition
    const where: any = {
      IS_DELETED: 0,
    };

    if (status) {
      where.EMP_STATUS_ID = Number(status);
    }
    if (department) {
      where.DEPARTMENT = Number(department);
    }
    if (manager) {
      where.MANAGER_ID = Number(manager);
    }

    if (search) {
      where.OR = [
        { EMP_NAME: { contains: search, mode: "insensitive" } },
        { EMPLST_NM: { contains: search, mode: "insensitive" } },
        { EMP_NBR: { contains: search, mode: "insensitive" } },
        { OA_CNTCT_EML_ID: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch employees matching criteria
    const employees = await prisma.emp_mst.findMany({
      where,
      orderBy: {
        EMP_ID: "asc",
      },
    });

    // Fetch lookups from independent_mst to resolve IDs in memory
    const lookups = await prisma.independent_mst.findMany({
      where: {
        OR: [{ IS_DELETED: false }, { IS_DELETED: null }],
      },
      select: {
        MSTR_ID: true,
        MSTR_NM: true,
      },
    });

    // Build lookup maps
    const lookupMap = new Map<number, string>();
    lookups.forEach((item) => {
      lookupMap.set(item.MSTR_ID, item.MSTR_NM);
    });

    // Build manager name map from all active employees
    const allEmployees = await prisma.emp_mst.findMany({
      where: { IS_DELETED: 0 },
      select: {
        EMP_ID: true,
        EMP_NAME: true,
        EMP_MIDDLE_NM: true,
        EMPLST_NM: true,
      },
    });

    const employeeNameMap = new Map<number, string>();
    allEmployees.forEach((emp) => {
      const middle = emp.EMP_MIDDLE_NM ? ` ${emp.EMP_MIDDLE_NM}` : "";
      const last = emp.EMPLST_NM ? ` ${emp.EMPLST_NM}` : "";
      const fullName = `${emp.EMP_NAME || ""}${middle}${last}`.trim();
      employeeNameMap.set(emp.EMP_ID, fullName || `Employee #${emp.EMP_ID}`);
    });

    // Map records to include resolved names and all data columns
    const resolvedEmployees = employees.map((emp) => {
      const middle = emp.EMP_MIDDLE_NM ? ` ${emp.EMP_MIDDLE_NM}` : "";
      const last = emp.EMPLST_NM ? ` ${emp.EMPLST_NM}` : "";
      const fullName = `${emp.EMP_NAME || ""}${middle}${last}`.trim();

      const military = emp.EMP_MILITARY_SERVICE
        ? (emp.EMP_MILITARY_SERVICE.toLowerCase() === "yes" || emp.EMP_MILITARY_SERVICE === "1" ? "Yes" : "No")
        : "No";

      const smoker = emp.IS_SMOKER === 1 ? "Yes" : "No";
      const titleName = emp.TITLE ? lookupMap.get(emp.TITLE) || "-" : "-";

      return {
        ...emp,
        EMP_FULL_NAME: fullName || "-",
        TITLE_NAME: titleName,
        TITLE_NM: titleName,
        DEPARTMENT_NAME: emp.DEPARTMENT ? lookupMap.get(emp.DEPARTMENT) || "-" : "-",
        GENDER_NAME: emp.GENDER_ID ? lookupMap.get(emp.GENDER_ID) || "-" : "-",
        MARITAL_STATUS_NAME: emp.MARITAL_STATUS_ID ? lookupMap.get(emp.MARITAL_STATUS_ID) || "-" : "-",
        EMP_STATUS_NAME: emp.EMP_STATUS_ID ? lookupMap.get(emp.EMP_STATUS_ID) || "Current" : "Current",
        MANAGER_NAME: emp.MANAGER_ID ? employeeNameMap.get(emp.MANAGER_ID) || "-" : "-",
        IS_MANAGER_TEXT: emp.IS_MANAGER === "1" ? "Yes" : "No",
        IS_MANAGER: emp.IS_MANAGER === "1" ? "Yes" : (emp.IS_MANAGER || "No"),
        BLOOD_GROUP: emp.BLOOD_GRP || "-",
        IS_SMOKER_TEXT: smoker,
        EMAIL_ADDRESS: emp.OA_CNTCT_EML_ID || "-",
        PHONE_NUMBER: emp.OA_CNTCT_PHONE_ID || "-",
        SSN_NUMBER: emp.EMP_SSN_NBR || "-",
        AADHAR_NO: emp.EXT_REF_EMP_NO || emp.EMP_OTHER_ID || "-",
        PAN_NUMBER: emp.EMP_PAN_NBR || "-",
        DRIVING_LICENSE_NUMBER: emp.EMP_DRI_LICE_NBR || "-",
        DRIVING_LICENSE_EXPIRY_DATE: emp.EMP_DRI_LICE_EXP_DATE || null,
        TAX_ALLOWANCE_TYPE: emp.TAX_ALLOWANCE_TYPE_ID ? lookupMap.get(emp.TAX_ALLOWANCE_TYPE_ID) || "-" : "-",
        MILITARY_SERVICE: military,
        CAREER_STREAM_NAME: emp.CAREERSTREAM_ID ? lookupMap.get(emp.CAREERSTREAM_ID) || "-" : "-",
        SKYPE_ID: emp.SKYPE_ID || "-",
        BRAND: "DEMO",
        EMP_JOB_STATUS_NAME: emp.JOB_CAT_ID ? lookupMap.get(emp.JOB_CAT_ID) || "Probation" : "Probation",
        CAST: emp.CAST_ID ? lookupMap.get(emp.CAST_ID) || "-" : "-",
        RAISE: emp.RAISE_ID ? lookupMap.get(emp.RAISE_ID) || "-" : "-",
        ETHINICITY: emp.ETHINICITY_ID ? lookupMap.get(emp.ETHINICITY_ID) || "-" : "-",
        MARRIAGE_DATE: emp.MARRIAGE_DATE || null,
        MAIDEN_NAME: emp.MAIDEN_NAME || "-",
        COST_CENTER: emp.COST_CENTER || "-",
        EMP_SIN_NBR: emp.EMP_SIN_NBR || "-",
        IS_DIRECTOR: emp.IS_DIRECTOR === 1 ? "Yes" : "No",
        IS_BUSINESS_OWNER: emp.IS_BUSINESS_OWNER === 1 ? "Yes" : "No",
        IS_PSC: emp.IS_PSC === 1 ? "Yes" : "No",
        IS_SHAREHOLDER: emp.IS_SHAREHOLDER === 1 ? "Yes" : "No",
        TAX_REF_NO: emp.TAX_REF_NO || "-",
        IS_DISABLE: emp.IS_DISABLE === 1 ? "Yes" : "No",
        NI_TABLE: emp.NI_TABLE || "-",
      };
    });

    return NextResponse.json({
      success: true,
      data: resolvedEmployees,
    });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch employees." },
      { status: 500 }
    );
  }
}
