'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsRow } from './settings-row';
import { SettingsSection } from './settings-section';

export function GeneralSettings() {
  const t = useTranslations('settings.general');
  const tCommon = useTranslations('settings');

  const [instanceName, setInstanceName] = useState('Influx Network Lab');
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [timezone, setTimezone] = useState('America/Mexico_City');

  return (
    <div className="space-y-6">
      <SettingsSection title={t('title')} subtitle={t('subtitle')}>
        <SettingsRow
          label={t('instanceName.label')}
          description={t('instanceName.helper')}
        >
          <Input
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t('defaultLocale.label')}
          description={t('defaultLocale.helper')}
        >
          <Select value={defaultLocale} onValueChange={setDefaultLocale}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label={t('timezone.label')}
          description={t('timezone.helper')}
        >
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/Mexico_City">America/Mexico_City</SelectItem>
              <SelectItem value="America/New_York">America/New_York</SelectItem>
              <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
              <SelectItem value="Europe/London">Europe/London</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button variant="brand">{tCommon('save')}</Button>
      </div>
    </div>
  );
}
