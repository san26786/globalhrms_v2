import { notFound } from "next/navigation";

import DeclarationsPage from "./DeclarationsPage";

/** CI employeeMngt/emp_investment_declarations/index/{investment_id} — ?investment=<Investment Details id>. */
export default async function InvestmentDeclarationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { investment } = await searchParams;
  if (typeof investment !== "string" || !/^\d+$/.test(investment)) notFound();
  return <DeclarationsPage investment={investment} />;
}
