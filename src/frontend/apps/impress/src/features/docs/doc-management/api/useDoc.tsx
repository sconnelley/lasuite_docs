import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

export type DocParams = {
  id: string;
};

export const getDoc = async ({ id }: DocParams): Promise<Doc> => {
  console.log('[Document API] Fetching document', {
    docId: id,
    timestamp: new Date().toISOString(),
    stack: new Error().stack?.split('\n').slice(1, 4).join('\n'), // Get caller info
  });
  const response = await fetchAPI(`documents/${id}/`);

  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  const doc = await response.json();
  console.log('[Document API] Document fetched successfully', {
    docId: id,
    timestamp: new Date().toISOString(),
  });
  return doc as Promise<Doc>;
};

export const KEY_DOC = 'doc';
export const KEY_DOC_VISIBILITY = 'doc-visibility';

export function useDoc(
  param: DocParams,
  queryConfig?: UseQueryOptions<Doc, APIError, Doc>,
) {
  return useQuery<Doc, APIError, Doc>({
    queryKey: queryConfig?.queryKey ?? [KEY_DOC, param],
    queryFn: () => getDoc(param),
    ...queryConfig,
  });
}
