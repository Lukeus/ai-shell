import React from 'react';
import { SddPanelView } from './SddPanel.view';
import { useSddPanel } from './useSddPanel';

export function SddPanel() {
  const viewProps = useSddPanel();
  return <SddPanelView {...viewProps} />;
}
