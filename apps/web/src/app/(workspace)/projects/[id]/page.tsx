import { FolderKanban } from "lucide-react";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { ProjectDetailView } from "@/features/projects/project-detail-view";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  return (
    <WorkspacePage title="Project" description="Long-lived context for related conversations." icon={FolderKanban}>
      <ProjectDetailView projectId={projectId} />
    </WorkspacePage>
  );
}
