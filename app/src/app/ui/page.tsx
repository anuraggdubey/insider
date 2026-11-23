import { notFound } from "next/navigation";
import { Showcase } from "./showcase";

export const metadata = {
  title: "UI showcase — INSIDER",
  description: "Development-only INSIDER design system showcase.",
  robots: { index: false, follow: false },
};

export default function UiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
