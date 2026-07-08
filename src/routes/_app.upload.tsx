import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_app/upload")({
  head: () => ({ meta: [{ title: "Upload assignment — Academic Copilot" }] }),
  component: UploadPage,
});

function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Upload assignment</h1>
      <p className="mt-2 text-muted-foreground">
        Drop a syllabus, brief, or PDF. Your copilot will analyze scope and effort.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium">Drag & drop your file</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, or paste text — up to 20MB</p>
        <button
          disabled
          className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground opacity-60"
        >
          Choose file
        </button>
      </div>
    </div>
  );
}
