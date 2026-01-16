import React from 'react';
import type { ConnectionDetailProps } from './ConnectionDetail.types';
import { ConnectionDetailView } from './ConnectionDetail.view';
import { useConnectionDetail } from './useConnectionDetail';

export type { ConnectionFormValues } from './ConnectionDetail.types';

export function ConnectionDetail(props: ConnectionDetailProps) {
  const viewProps = useConnectionDetail(props);
  return <ConnectionDetailView {...viewProps} />;
}
