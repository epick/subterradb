'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SettingsRow } from './settings-row';
import { SettingsSection } from './settings-section';

// Danger zone — destructive actions on the SubterraDB instance.
// Each row is a label + description + a tinted destructive button.
export function DangerZone() {
  const t = useTranslations('settings.dangerZone');

  const actions = ['exportData', 'reset', 'factoryReset'] as const;

  return (
    <SettingsSection title={t('title')} subtitle={t('subtitle')} danger>
      {actions.map((key) => (
        <SettingsRow
          key={key}
          label={t(`${key}.label`)}
          description={t(`${key}.description`)}
          danger
        >
          <div className="flex justify-end">
            <Button variant="outline" className="border-red-500/40 text-red-300 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200">
              {t(`${key}.action`)}
            </Button>
          </div>
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}
