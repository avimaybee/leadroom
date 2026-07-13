export const dynamic = 'force-dynamic';

import { PipelineBoard } from '@/components/pipeline/PipelineBoard';

export const metadata = {
  title: 'Pipeline | Leadroom',
};

export default function PipelinePage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-heading-2xl">Pipeline</h2>
        <p className="text-copy-14 text-muted-foreground mt-1">
          Drag-free kanban view of all prospects by stage.
        </p>
      </div>
      <PipelineBoard />
    </div>
  );
}
