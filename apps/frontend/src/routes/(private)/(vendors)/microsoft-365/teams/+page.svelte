<script lang="ts">
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, boolBadgeColumn, nullableTextColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import TeamsSheet from './_teams-sheet.svelte';

  type TeamsRow = {
    id: string;
    externalId: string;
    allowAnonymousUsersToJoinMeeting: boolean | null;
    allowExternalParticipantGiveRequestControl: boolean | null;
    allowPSTNUsersToBypassLobby: boolean | null;
    autoAdmittedUsers: string | null;
    allowFederatedUsers: boolean | null;
    allowPublicUsers: boolean | null;
    allowTeamsConsumer: boolean | null;
    allowedDomains: string[] | null;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<TeamsRow>[] = [
    textColumn<TeamsRow>('externalId', 'Policy'),
    boolBadgeColumn<TeamsRow>('allowAnonymousUsersToJoinMeeting', 'Anon. Join', {
      trueLabel: 'Allowed',
      falseLabel: 'Blocked',
      falseVariant: 'muted',
    }),
    boolBadgeColumn<TeamsRow>('allowExternalParticipantGiveRequestControl', 'Ext. Control', {
      trueLabel: 'Allowed',
      falseLabel: 'Blocked',
      falseVariant: 'muted',
    }),
    boolBadgeColumn<TeamsRow>('allowPSTNUsersToBypassLobby', 'PSTN Bypass', {
      trueLabel: 'Allowed',
      falseLabel: 'Blocked',
      falseVariant: 'muted',
    }),
    nullableTextColumn<TeamsRow>('autoAdmittedUsers', 'Auto-Admit'),
    boolBadgeColumn<TeamsRow>('allowFederatedUsers', 'Federation', {
      trueLabel: 'Allowed',
      falseLabel: 'Blocked',
      falseVariant: 'muted',
    }),
  ];

  let selectedPolicy = $state<TeamsRow | null>(null);
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view Teams policies</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else}
  <VendorDataTable
    table="m365_teams_config"
    linkId={scopeStore.currentLink}
    {columns}
    onrowclick={(row) => (selectedPolicy = row as TeamsRow)}
  />
{/if}

<TeamsSheet
  policy={selectedPolicy}
  onclose={() => (selectedPolicy = null)}
/>
