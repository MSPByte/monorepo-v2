<script lang="ts">
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, boolBadgeColumn, relativeDateColumn, nullableTextColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import DeviceSheet from './_device-sheet.svelte';

  type DeviceRow = {
    id: string;
    displayName: string;
    operatingSystem: string | null;
    operatingSystemVersion: string | null;
    isCompliant: boolean | null;
    isManaged: boolean | null;
    deviceOwnership: string | null;
    approximateLastSignInAt: string | null;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<DeviceRow>[] = [
    textColumn<DeviceRow>('displayName', 'Device Name'),
    nullableTextColumn<DeviceRow>('operatingSystem', 'OS'),
    nullableTextColumn<DeviceRow>('operatingSystemVersion', 'Version', { defaultHidden: true }),
    boolBadgeColumn<DeviceRow>('isCompliant', 'Compliant', {
      trueLabel: 'Compliant',
      falseLabel: 'Non-Compliant',
      falseVariant: 'destructive',
    }),
    boolBadgeColumn<DeviceRow>('isManaged', 'Managed', {
      trueLabel: 'Managed',
      falseLabel: 'Unmanaged',
      falseVariant: 'destructive',
    }),
    nullableTextColumn<DeviceRow>('deviceOwnership', 'Ownership'),
    relativeDateColumn<DeviceRow>('approximateLastSignInAt', 'Last Sign-in'),
  ];

  let selectedDevice = $state<DeviceRow | null>(null);
</script>

<VendorDataTable
  table="m365_devices"
  linkId={scopeStore.currentLink || undefined}
  integrationId="microsoft-365"
  {columns}
  onrowclick={(row) => (selectedDevice = row as DeviceRow)}
/>

<DeviceSheet
  device={selectedDevice}
  onclose={() => (selectedDevice = null)}
/>
