'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsRow } from './settings-row';
import { SettingsSection } from './settings-section';

export function SecuritySettings() {
  const t = useTranslations('settings.security');
  const tCommon = useTranslations('settings');

  const [sessionTimeout, setSessionTimeout] = useState('480');
  const [minPasswordLength, setMinPasswordLength] = useState('12');
  const [mfaRequired, setMfaRequired] = useState(true);

  return (
    <div className="space-y-6">
      <SettingsSection title={t('title')} subtitle={t('subtitle')}>
        <SettingsRow
          label={t('sessionTimeout.label')}
          description={t('sessionTimeout.helper')}
        >
          <Input
            type="number"
            min={5}
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t('minPasswordLength.label')}
          description={t('minPasswordLength.helper')}
        >
          <Input
            type="number"
            min={8}
            value={minPasswordLength}
            onChange={(e) => setMinPasswordLength(e.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t('mfaRequired.label')}
          description={t('mfaRequired.helper')}
        >
          <div className="flex items-center justify-end">
            <Switch checked={mfaRequired} onCheckedChange={setMfaRequired} />
          </div>
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button variant="brand">{tCommon('save')}</Button>
      </div>
    </div>
  );
}
