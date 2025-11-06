import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useClipboard } from '@/hook';
import { getDocUrlAbsolute } from '@/utils/url';

import { Doc } from '../types';

export const useCopyDocLink = (docId: Doc['id']) => {
  const { t } = useTranslation();
  const copyToClipboard = useClipboard();

  return useCallback(() => {
    copyToClipboard(
      getDocUrlAbsolute(docId),
      t('Link Copied !'),
      t('Failed to copy link'),
    );
  }, [copyToClipboard, docId, t]);
};
