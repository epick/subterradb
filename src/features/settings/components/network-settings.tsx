'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsRow } from './settings-row';
import { SettingsSection } from './settings-section';

export function NetworkSettings() {
  const t = useTranslations('settings.network');
  const tCommon = useTranslations('settings');

  const [gatewayHost, setGatewayHost] = useState('subterra.local');
  const [portRangeStart, setPortRangeStart] = useState('40000');
  const [portRangeEnd, setPortRangeEnd] = useState('41000');
  const [tlsEnabled, setTlsEnabled] = useState(true);

  return (
    <div className="space-y-6">
      <SettingsSection title={t('title')} subtitle={t('subtitle')}>
        <SettingsRow
          label={t('gatewayHost.label')}
          description={t('gatewayHost.helper')}
        >
          <Input
            value={gatewayHost}
            onChange={(e) => setGatewayHost(e.target.value)}
            className="font-mono"
          />
        </SettingsRow>

        <SettingsRow
          label={t('portRange.label')}
          description={t('portRange.helper')}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={portRangeStart}
              onChange={(e) => setPortRangeStart(e.target.value)}
              className="font-mono"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="number"
              value={portRangeEnd}
              onChange={(e) => setPortRangeEnd(e.target.value)}
              className="font-mono"
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label={t('tlsEnabled.label')}
          description={t('tlsEnabled.helper')}
        >
          <div className="flex items-center justify-end">
            <Switch checked={tlsEnabled} onCheckedChange={setTlsEnabled} />
          </div>
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button variant="brand">{tCommon('save')}</Button>
      </div>
    </div>
  );
}
