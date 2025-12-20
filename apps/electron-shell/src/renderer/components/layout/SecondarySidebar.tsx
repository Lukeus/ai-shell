import { PanelHeader, ResizablePanel } from 'packages-ui-kit';
import { AgentsPanel } from '../agents/AgentsPanel';

type SecondarySidebarProps = {
  width: number;
  collapsed: boolean;
  onResize: (width: number) => void;
  onToggleCollapse: () => void;
};

export function SecondarySidebar({
  width,
  collapsed,
  onResize,
  onToggleCollapse,
}: SecondarySidebarProps) {
  return (
    <ResizablePanel
      direction="horizontal"
      size={width}
      minSize={200}
      maxSize={600}
      collapsed={collapsed}
      defaultSize={300}
      handlePosition="start"
      onResize={onResize}
      onToggleCollapse={onToggleCollapse}
    >
      <div className="flex flex-col h-full">
        <PanelHeader
          title="Agents"
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
        <AgentsPanel />
      </div>
    </ResizablePanel>
  );
}
