import type { Metadata } from "next";
import { WorkForm } from "../WorkForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add work" };

export default function NewWorkPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Add a work</h1>
        <p className="page-subtitle">
          Search TMDb for a film or TV series to import it, or enter a work manually.
        </p>
      </div>
      <WorkForm />
    </>
  );
}
