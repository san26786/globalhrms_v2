import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_BANKS = [
  { code: "BNICICI", name: "ICICI Bank", desc: "" },
  { code: "BNHSBC", name: "HSBC", desc: "" },
  { code: "BNHDFC", name: "HDFC", desc: "" },
  { code: "BNDB", name: "Dena Bank", desc: "" },
  { code: "BNBOI", name: "Bank Of India", desc: "" },
  { code: "BNBC", name: "Bassien Catholic Bank", desc: "Bank Name testing" },
  { code: "BNBARCL", name: "Barclays", desc: "" },
  { code: "BNAXISB", name: "Axis Bank", desc: "" },
  { code: "BNBOB", name: "Bank Of Baroda", desc: "" },
  { code: "78", name: "SWASWAT BANK", desc: "pvt Ltd" },
  { code: "BNUBI", name: "Union Bank Of India", desc: "" },
  { code: "BNTSB", name: "TSB", desc: "" },
  { code: "BNSBI", name: "State Bank of india", desc: "" },
  { code: "BNSANT", name: "Santandar", desc: "" },
  { code: "BNRBI", name: "RBI", desc: "" },
  { code: "BNPNB", name: "Punjab National Bank", desc: "" },
  { code: "BNPMC", name: "Punjab Maharashtra Bank", desc: "" },
  { code: "BNNW", name: "Natwest", desc: "" },
  { code: "BNMB", name: "Mumbai Bank", desc: "" },
  { code: "BNLLOYDS", name: "Lloyds Bank", desc: "" },
  { code: "45", name: "BOI", desc: "fhjksaj" }
];

export async function GET() {
  try {
    // 1. Fetch Bank Names Type (SEBN)
    const sebnType = await prisma.common_type.findFirst({
      where: { TYP_CD: "SEBN" },
    });

    const bankOptions = [];

    if (sebnType) {
      // Seed/resolve banks against the database keys in independent_mst
      for (const bank of DEFAULT_BANKS) {
        let existingBank = await prisma.independent_mst.findFirst({
          where: {
            TYP_ID: sebnType.TYP_ID,
            MSTR_NM: {
              equals: bank.name,
              mode: "insensitive",
            },
          },
        });

        if (existingBank) {
          // Sync code and description if missing/different
          if (existingBank.MSTR_CD !== bank.code || existingBank.MSTR_DESC !== bank.desc) {
            existingBank = await prisma.independent_mst.update({
              where: { MSTR_ID: existingBank.MSTR_ID },
              data: {
                MSTR_CD: bank.code,
                MSTR_DESC: bank.desc
              }
            });
          }
        } else {
          // Create the missing bank master record
          existingBank = await prisma.independent_mst.create({
            data: {
              MSTR_CD: bank.code,
              MSTR_NM: bank.name,
              MSTR_DESC: bank.desc,
              TYP_ID: sebnType.TYP_ID,
              IS_DEFAULT_FOR_SYNC: false,
              SEQUENCE: 0,
              IS_ACTIVE: 1,
              IS_ENABLED: 1,
              IS_DELETED: false,
            },
          });
        }

        bankOptions.push({
          label: existingBank.MSTR_NM,
          value: String(existingBank.MSTR_ID),
        });
      }
    } else {
      // Fallback if SEBN type is completely missing in database
      DEFAULT_BANKS.forEach((bank, index) => {
        bankOptions.push({
          label: bank.name,
          value: String(index + 1),
        });
      });
    }

    // Sort bank options alphabetically by label
    bankOptions.sort((a, b) => a.label.localeCompare(b.label));

    // 2. Available database fields from banksheet table
    const dbFields = [
      "TRANSACTION_DATE",
      "TRANSACTION_STATUS",
      "PARTICULARS",
      "CHQNO_REFNO",
      "CREDIT_AMOUNT",
      "DEBIT_AMOUNT",
      "CLOSING_BAL",
      "SOL",
      "ACCOUNTING_TRANSACTION_TYPE",
      "CATEGORY_TYPE",
      "CATEGORY",
      "NOTES",
      "TRANSACTION_TYPE",
      "SORT_CODE",
      "DESCRIPTION",
      "VALUE",
      "ACCOUNT_NM",
      "ACCOUNT_NO",
    ];

    // 3. Requested By Options
    const rawRequestedBy = [
      "Pratiksha Shankar Rane",
      "Tabassum",
      "RuchikaD",
      "Ronaldo Vyas",
      "Ricardo1",
      "Haaku Sami",
      "Dummyuser1",
      "Dummyuser Bam",
      "Bhushan More",
      "Priyanka jaoyy Rakesh",
      "Noddy jaoyy Rakesh",
      "Ankush jaoyy Rakesh",
      "PEN E GITAM",
      "User Jagruthi User",
      "User Rohitha Username",
      "Kiran Anil Mishra",
      "Nagendra Kanhaiyalal Mishra",
      "Sanjeev Mishra",
      "Amit Bam",
      "Ananya Anil Mishra",
      "Anjali Mankar Ram karkar",
      "Michael Mac Jackson",
      "Latayata Hari Deshmukh",
      "Mayata",
      "Shweta",
      "Seema Ramesh Pokharkar",
      "Pareshtest",
      "Pareshtest2",
      "Paresh PP Yadav",
      "Pareshtest4",
      "RajanP",
      "Paresh Test",
      "Mohdsalman",
      "Pashupati Rajesh Khalar",
      "Ankita Gurav",
      "PankajV",
      "ShubhamK Ramesh Henry",
      "DEMOadmin1",
      "Arun Test",
      "Arunangshu Pradhan",
      "Rahul Hui",
      "Mitul Bera",
      "Bultan Das",
      "MasterUser",
      "Raju Sing Sasmol",
      "achivement",
      "Emp",
      "Santanu Manna",
      "Sanjib Pradhan",
      "Deepak K Demo",
      "raju das",
      "shreyasd",
      "prathmeshp",
      "Shreyas test",
      "PoonamM Manish Meshram",
      "TestVarsha Bhausaheb Pachorkar",
      "alphatester beta",
      "My devportal",
      "Rohity Raghunath Yelamkar",
      "shamita_y",
      "alphatester1",
      "chanchal Singh",
      "Peter Smith",
      "Loan Emp",
      "Santanu Bera",
      "Shubhasis Maity",
      "Satyajit Roy",
      "raju Das",
      "Tanmay Sasmol",
      "Sayndip Kotal",
      "Sumanta Das",
      "Piku sing",
      "Sujata Das",
      "Shubhas Bose"
    ];

    const uniqueRequestedBy = Array.from(new Set(rawRequestedBy));

    const requestedByOptions = uniqueRequestedBy.map(name => ({
      label: name,
      value: name,
    }));

    return NextResponse.json({
      success: true,
      bankNames: bankOptions,
      dbFields,
      requestedByOptions,
    });
  } catch (error) {
    console.error("Statement setting lookup failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch statement lookup details." },
      { status: 500 }
    );
  }
}
