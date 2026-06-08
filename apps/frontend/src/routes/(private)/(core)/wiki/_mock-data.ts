// ---- Types ----

export type CalloutVariant = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

export interface WikiTag {
  id: string;
  label: string;
  color: string; // OKLCH color string
}

export interface WikiCategory {
  id: string;
  label: string;
  description?: string;
  parent_id: string | null; // null = root level
}

export interface WikiArticle {
  id: string;
  title: string;
  primary_context_id: string;
  linked_context_ids: string[];
  tag_ids: string[];
  body: string;
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
  author: string;
}

export interface WikiSite {
  id: string;
  name: string;
}

export type OverrideType = 'addendum' | 'replacement' | 'note';

export interface WikiOverride {
  id: string;
  article_id: string;
  site_id: string;
  site_name: string;
  title: string;
  content: string;
  type: OverrideType;
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
}

export interface WikiArticleVersion {
  id: string;
  article_id: string;
  version_number: number;
  change_note: string | null;
  changed_by: string;
  created_at: string;
}

// ---- Helpers ----

export function getCategoryPath(categoryId: string, categories: WikiCategory[]): WikiCategory[] {
  const path: WikiCategory[] = [];
  let current = categories.find((c) => c.id === categoryId);
  while (current) {
    path.unshift(current);
    const parent = current.parent_id
      ? categories.find((c) => c.id === current!.parent_id)
      : undefined;
    current = parent;
  }
  return path;
}

export const getContextPath = getCategoryPath;

export function getCategoryChildren(
  parentId: string | null,
  categories: WikiCategory[]
): WikiCategory[] {
  return categories.filter((c) => c.parent_id === parentId);
}

export const getContextChildren = getCategoryChildren;

export function getAllDescendantIds(categoryId: string, categories: WikiCategory[]): string[] {
  const result: string[] = [categoryId];
  const children = getCategoryChildren(categoryId, categories);
  for (const child of children) {
    result.push(...getAllDescendantIds(child.id, categories));
  }
  return result;
}

export function getArticleCount(categoryId: string, articles: WikiArticle[]): number {
  return articles.filter((a) => a.primary_context_id === categoryId).length;
}

export function getLinkedArticleCount(categoryId: string, articles: WikiArticle[]): number {
  return articles.filter((a) => a.linked_context_ids.includes(categoryId)).length;
}

export function getArticlesForContext(
  contextId: string,
  articles: WikiArticle[]
): Array<WikiArticle & { context_role: 'primary' | 'linked' }> {
  return articles
    .filter((a) => a.primary_context_id === contextId || a.linked_context_ids.includes(contextId))
    .map((a) => ({
      ...a,
      context_role: a.primary_context_id === contextId ? 'primary' : 'linked',
    }));
}

// ---- Tags ----

export const MOCK_TAGS: Record<string, WikiTag> = {
  'tag-onboarding': { id: 'tag-onboarding', label: 'Onboarding', color: 'oklch(0.72 0.18 148.9)' },
  'tag-guide': { id: 'tag-guide', label: 'Guide', color: 'oklch(0.62 0.188 259.8)' },
  'tag-quickstart': {
    id: 'tag-quickstart',
    label: 'Quickstart',
    color: 'oklch(0.72 0.18 148.9)',
  },
  'tag-networking': {
    id: 'tag-networking',
    label: 'Networking',
    color: 'oklch(0.62 0.188 259.8)',
  },
  'tag-troubleshooting': {
    id: 'tag-troubleshooting',
    label: 'Troubleshooting',
    color: 'oklch(0.737 0.153 74.2)',
  },
  'tag-vpn': { id: 'tag-vpn', label: 'VPN', color: 'oklch(0.58 0.18 290)' },
  'tag-dns': { id: 'tag-dns', label: 'DNS', color: 'oklch(0.75 0.18 65)' },
  'tag-security': { id: 'tag-security', label: 'Security', color: 'oklch(0.637 0.208 25.33)' },
  'tag-compliance': {
    id: 'tag-compliance',
    label: 'Compliance',
    color: 'oklch(0.637 0.208 25.33)',
  },
  'tag-windows': { id: 'tag-windows', label: 'Windows', color: 'oklch(0.62 0.188 259.8)' },
  'tag-patching': { id: 'tag-patching', label: 'Patching', color: 'oklch(0.737 0.153 74.2)' },
  'tag-monitoring': {
    id: 'tag-monitoring',
    label: 'Monitoring',
    color: 'oklch(0.62 0.188 259.8)',
  },
  'tag-backup': { id: 'tag-backup', label: 'Backup', color: 'oklch(0.72 0.18 148.9)' },
  'tag-automation': {
    id: 'tag-automation',
    label: 'Automation',
    color: 'oklch(0.58 0.18 290)',
  },
};

// ---- Contexts (flat, parent_id-based) ----

export const MOCK_CATEGORIES: WikiCategory[] = [
  {
    id: 'ctx-software',
    label: 'Software',
    description: 'Vendor applications and SaaS platforms',
    parent_id: null,
  },
  {
    id: 'ctx-software-microsoft',
    label: 'Microsoft',
    description: 'Microsoft cloud and productivity services',
    parent_id: 'ctx-software',
  },
  {
    id: 'ctx-software-microsoft-powerbi',
    label: 'Power BI',
    description: 'Power BI tenant, licensing, gateways, and refresh operations',
    parent_id: 'ctx-software-microsoft',
  },
  {
    id: 'ctx-software-microsoft-entra',
    label: 'Entra ID',
    description: 'Identity, groups, MFA, and access policy operations',
    parent_id: 'ctx-software-microsoft',
  },
  {
    id: 'ctx-infrastructure',
    label: 'Infrastructure',
    description: 'Client infrastructure and shared operational systems',
    parent_id: null,
  },
  {
    id: 'ctx-infrastructure-network',
    label: 'Network',
    description: 'Switching, routing, DNS, VPN, and connectivity',
    parent_id: 'ctx-infrastructure',
  },
  {
    id: 'ctx-infrastructure-network-dns',
    label: 'DNS',
    description: 'DNS resolution, split DNS, and resolver behavior',
    parent_id: 'ctx-infrastructure-network',
  },
  {
    id: 'ctx-infrastructure-network-vpn',
    label: 'VPN & Tunnels',
    description: 'Remote access and site-to-site tunnel operations',
    parent_id: 'ctx-infrastructure-network',
  },
  {
    id: 'ctx-infrastructure-firewalls',
    label: 'Firewalls',
    description: 'Perimeter firewall standards and remote access changes',
    parent_id: 'ctx-infrastructure',
  },
  {
    id: 'ctx-infrastructure-gateways',
    label: 'Gateways',
    description: 'On-prem and cloud gateway components',
    parent_id: 'ctx-infrastructure',
  },
  {
    id: 'ctx-security',
    label: 'Security',
    description: 'Security policy, compliance, and incident response',
    parent_id: null,
  },
  {
    id: 'ctx-security-policies',
    label: 'Policies',
    description: 'Reusable security policy documentation',
    parent_id: 'ctx-security',
  },
  {
    id: 'ctx-security-compliance',
    label: 'Compliance Failures',
    description: 'Docs linked from compliance findings and remediation flows',
    parent_id: 'ctx-security',
  },
  {
    id: 'ctx-operations',
    label: 'Operations',
    description: 'Reusable runbooks and daily technician workflows',
    parent_id: null,
  },
  {
    id: 'ctx-operations-alerts',
    label: 'Alerts',
    description: 'Runbooks attached to alert definitions',
    parent_id: 'ctx-operations',
  },
  {
    id: 'ctx-operations-onboarding',
    label: 'Onboarding',
    description: 'New client and new technician operating procedures',
    parent_id: 'ctx-operations',
  },
  {
    id: 'ctx-endpoints',
    label: 'Endpoints',
    description: 'Endpoint lifecycle, patching, and device operations',
    parent_id: null,
  },
  {
    id: 'ctx-endpoints-windows',
    label: 'Windows',
    description: 'Windows endpoint standards and patching procedures',
    parent_id: 'ctx-endpoints',
  },
];

// ---- Articles ----

const BODY_KB001 = `
<h1>Getting Started with MSPByte</h1>
<p>Welcome to MSPByte — your all-in-one MSP management platform. This guide will walk you through the initial setup and help you get your first integration connected.</p>
<h2>Prerequisites</h2>
<ol><li>An active MSPByte account with admin privileges</li><li>API credentials for your PSA or RMM tool</li><li>Network access to your on-premises systems (if applicable)</li></ol>
<h2>Step 1: Connect Your First Integration</h2>
<p>Navigate to <strong>Integrations</strong> in the sidebar and click <strong>Add Integration</strong>. Select your platform from the list.</p>
<blockquote><p>Tip: If you're using Datto RMM, make sure your API user has read access to all sites before connecting.</p></blockquote>
<h2>Step 2: Verify Your Data</h2>
<p>Once connected, MSPByte will begin syncing your data. This can take a few minutes depending on the size of your environment.</p>
<pre><code>Error: 401 Unauthorized
Fix: Regenerate the API key in your integration settings and reconnect.</code></pre>
<h2>Related Guides</h2>
<p>After completing this guide, refer to KB003 for a detailed walkthrough of initial platform configuration. For DNS-related issues during setup, see KB007.</p>
`.trim();

const BODY_KB002 = `
<h1>Network Troubleshooting Guide</h1>
<p>This guide covers the most common network issues encountered in managed environments.</p>
<h2>Connectivity Issues</h2>
<ul><li>Verify the device is powered on and the network cable is seated</li><li>Ping the device from the local subnet</li><li>Check DHCP lease status on the local router</li></ul>
<h2>DNS Resolution Failures</h2>
<pre><code>nslookup example.com 8.8.8.8</code></pre>
<h2>VPN Tunnel Drops</h2>
<p>Intermittent VPN drops are often caused by MTU mismatches. Try reducing the MTU on the tunnel interface to <strong>1380</strong> and test over 24 hours.</p>
`.trim();

const BODY_KB003 = `
<h1>Initial Platform Setup</h1>
<p>This guide walks through the first-time configuration of your MSPByte environment after account creation.</p>
<h2>1. Configure Your Organization Profile</h2>
<p>Set your organization name, timezone, and contact details under <strong>Settings → Organization</strong>.</p>
<h2>2. Invite Team Members</h2>
<p>Navigate to <strong>Settings → Team</strong> and use the invite flow to add team members. Assign appropriate roles.</p>
<h2>3. Enable Notifications</h2>
<p>Configure alerting thresholds and notification channels (email, Slack, PagerDuty) under <strong>Settings → Notifications</strong>.</p>
`.trim();

const BODY_KB004 = `
<h1>VPN Configuration Guide</h1>
<p>This guide covers setting up and maintaining VPN tunnels for managed client sites.</p>
<h2>Supported VPN Types</h2>
<ul><li>IPsec IKEv2</li><li>OpenVPN</li><li>WireGuard</li></ul>
<h2>IPsec IKEv2 Setup</h2>
<p>Use pre-shared keys for site-to-site tunnels. Store PSKs in the MSPByte credential vault, not in configuration files.</p>
<h2>Monitoring Tunnel Health</h2>
<p>Enable SNMP traps on your firewall to alert on tunnel state changes. Map these alerts to MSPByte tickets via the integration webhook.</p>
`.trim();

const BODY_KB005 = `
<h1>Security Policy Template</h1>
<p>Use this template as a starting point for client-facing security policies.</p>
<h2>Password Policy</h2>
<ul><li>Minimum 14 characters</li><li>At least one uppercase, lowercase, number, and symbol</li><li>No reuse of last 12 passwords</li><li>90-day rotation enforced via M365 Conditional Access</li></ul>
<h2>MFA Requirements</h2>
<p>All user accounts must enroll in MFA within 24 hours of provisioning. Acceptable methods: Authenticator app or hardware FIDO2 key.</p>
`.trim();

const BODY_KB006 = `
<h1>Windows Endpoint Patching</h1>
<p>This document describes the patching cadence and procedures for Windows endpoints managed through MSPByte.</p>
<h2>Patch Schedule</h2>
<ul><li><strong>Critical patches:</strong> Deploy within 24 hours of release</li><li><strong>Important patches:</strong> Deploy within 7 days</li><li><strong>Optional patches:</strong> Review monthly</li></ul>
<h2>Exclusions</h2>
<p>Defer patches that affect production line-of-business applications until vendor compatibility is confirmed. Document all deferrals.</p>
`.trim();

const BODY_KB007 = `
<h1>DNS Troubleshooting</h1>
<p>Common DNS issues and resolution steps for managed environments.</p>
<h2>Split DNS</h2>
<p>When clients report name resolution failures for internal resources while off-VPN, verify split-DNS configuration. Internal zones should resolve via the corporate DNS server, while external queries forward to 8.8.8.8.</p>
<h2>Stale Cache Entries</h2>
<pre><code>ipconfig /flushdns        # Windows
sudo dscacheutil -flushcache  # macOS
sudo systemd-resolve --flush-caches  # Linux</code></pre>
`.trim();

const BODY_KB008 = `
<h1>Firewall & Remote Access Runbook</h1>
<p>This runbook covers the standard procedures for configuring perimeter firewalls and remote access infrastructure across managed client sites. Follow this guide alongside KB002 for general network troubleshooting context.</p>
<h2>Firewall Baseline Configuration</h2>
<p>All managed firewalls must meet the following baseline before going into production:</p>
<ul>
  <li>Firmware updated to the latest stable release</li>
  <li>Default admin credentials changed and stored in the MSPByte vault</li>
  <li>Unused management interfaces disabled</li>
  <li>Logging enabled to syslog with a minimum 90-day retention</li>
  <li>Inbound management access restricted to the MSPByte management CIDR</li>
</ul>
<blockquote><p>Never leave RDP or SSH exposed directly to the internet. All management traffic must traverse the MSPByte VPN overlay or a jump host.</p></blockquote>
<h2>Remote Access Setup</h2>
<p>For site-to-site and remote user VPN, follow the procedures in KB004 before applying the firewall rules below. Confirm DNS resolution is functional (see KB007) before testing tunnel connectivity.</p>
<h2>Firewall Rule Order</h2>
<p>Rules are evaluated top-down. Apply them in this order to avoid inadvertent lockouts:</p>
<ol>
  <li><strong>Allow established/related</strong> — stateful return traffic</li>
  <li><strong>Allow management</strong> — MSPByte IP range to admin ports</li>
  <li><strong>Allow VPN overlay</strong> — tunnel interface traffic</li>
  <li><strong>Allow site services</strong> — site-specific business application rules</li>
  <li><strong>Deny all</strong> — implicit or explicit catch-all at the bottom</li>
</ol>
<h2>Testing & Validation</h2>
<p>After applying rules, validate connectivity using the checklist below:</p>
<pre><code># Confirm management reachability
ping -c 4 &lt;firewall-mgmt-ip&gt;

# Test outbound internet from a client host
curl -s https://check.mspbyte.io/connectivity

# Verify VPN tunnel state
show vpn ipsec status  # FortiGate / pfSense syntax varies</code></pre>
<h2>Change Management</h2>
<p>All firewall rule changes must be logged in MSPByte with a ticket reference. Emergency changes require a post-incident note within 24 hours.</p>
`.trim();

export const MOCK_ARTICLES: Record<string, WikiArticle> = {
  KB001: {
    id: 'KB001',
    title: 'Getting Started with MSPByte',
    primary_context_id: 'ctx-operations-onboarding',
    linked_context_ids: ['ctx-software'],
    tag_ids: ['tag-onboarding', 'tag-guide'],
    body: BODY_KB001,
    locked_by: 'Jane Smith',
    locked_at: '2026-04-07T09:00:00Z',
    updated_at: '2026-04-07T09:00:00Z',
    author: 'John Doe',
  },
  KB002: {
    id: 'KB002',
    title: 'Network Troubleshooting Guide',
    primary_context_id: 'ctx-infrastructure-network',
    linked_context_ids: ['ctx-operations-alerts'],
    tag_ids: ['tag-networking', 'tag-troubleshooting'],
    body: BODY_KB002,
    locked_by: null,
    locked_at: null,
    updated_at: '2026-04-01T11:00:00Z',
    author: 'Jane Smith',
  },
  KB003: {
    id: 'KB003',
    title: 'Initial Platform Setup',
    primary_context_id: 'ctx-operations-onboarding',
    linked_context_ids: [],
    tag_ids: ['tag-onboarding', 'tag-quickstart'],
    body: BODY_KB003,
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-28T14:00:00Z',
    author: 'John Doe',
  },
  KB004: {
    id: 'KB004',
    title: 'VPN Configuration Guide',
    primary_context_id: 'ctx-infrastructure-network-vpn',
    linked_context_ids: ['ctx-infrastructure-firewalls', 'ctx-operations-alerts'],
    tag_ids: ['tag-vpn', 'tag-networking'],
    body: BODY_KB004,
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-20T10:00:00Z',
    author: 'Alex Chen',
  },
  KB005: {
    id: 'KB005',
    title: 'Security Policy Template',
    primary_context_id: 'ctx-security-policies',
    linked_context_ids: ['ctx-security-compliance'],
    tag_ids: ['tag-security', 'tag-compliance'],
    body: BODY_KB005,
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-15T09:30:00Z',
    author: 'Jane Smith',
  },
  KB006: {
    id: 'KB006',
    title: 'Windows Endpoint Patching',
    primary_context_id: 'ctx-endpoints-windows',
    linked_context_ids: ['ctx-security-compliance'],
    tag_ids: ['tag-windows', 'tag-patching'],
    body: BODY_KB006,
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-10T16:00:00Z',
    author: 'Alex Chen',
  },
  KB007: {
    id: 'KB007',
    title: 'DNS Troubleshooting',
    primary_context_id: 'ctx-infrastructure-network-dns',
    linked_context_ids: ['ctx-operations-alerts'],
    tag_ids: ['tag-networking', 'tag-dns', 'tag-troubleshooting'],
    body: BODY_KB007,
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-05T12:00:00Z',
    author: 'John Doe',
  },
  KB008: {
    id: 'KB008',
    title: 'Firewall & Remote Access Runbook',
    primary_context_id: 'ctx-infrastructure-firewalls',
    linked_context_ids: ['ctx-infrastructure-network-vpn', 'ctx-operations-alerts'],
    tag_ids: ['tag-networking', 'tag-security', 'tag-vpn'],
    body: BODY_KB008,
    locked_by: null,
    locked_at: null,
    updated_at: '2026-04-06T13:00:00Z',
    author: 'Alex Chen',
  },
};

// ---- Sites ----

export const MOCK_SITES: WikiSite[] = [
  { id: 'site-acme', name: 'Acme Corp' },
  { id: 'site-techstart', name: 'TechStart Inc' },
  { id: 'site-megacorp', name: 'MegaCorp' },
  { id: 'site-pinnacle', name: 'Pinnacle LLC' },
];

// ---- Overrides ----

export const MOCK_OVERRIDES: WikiOverride[] = [
  {
    id: 'ov-001-acme',
    article_id: 'KB001',
    site_id: 'site-acme',
    site_name: 'Acme Corp',
    title: 'Acme Corp — Custom Integration Notes',
    content:
      '<h2>Acme Corp Specific Setup</h2><p>Acme Corp uses a self-hosted Datto RMM instance. When connecting, use the internal endpoint <code>https://rmm.acme.internal</code> instead of the standard cloud URL.</p><p>API keys are rotated every 30 days by the security team — coordinate with <strong>it-ops@acme.corp</strong> before any integration reconnect.</p>',
    type: 'addendum',
    locked_by: 'Jane Smith',
    locked_at: '2026-04-08T08:30:00Z',
    updated_at: '2026-04-05T14:00:00Z',
  },
  {
    id: 'ov-001-techstart',
    article_id: 'KB001',
    site_id: 'site-techstart',
    site_name: 'TechStart Inc',
    title: 'TechStart — Onboarding Exception',
    content:
      '<h2>Onboarding Exception</h2><p>TechStart does not use a PSA. Skip the PSA integration step entirely. Instead, connect directly to their M365 tenant using the credentials stored in the vault under <em>TechStart / M365 Admin</em>.</p>',
    type: 'note',
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-30T09:00:00Z',
  },
  {
    id: 'ov-001-megacorp',
    article_id: 'KB001',
    site_id: 'site-megacorp',
    site_name: 'MegaCorp',
    title: 'MegaCorp — Replacement Procedure',
    content:
      '<h1>MegaCorp Getting Started</h1><p>MegaCorp requires a completely different onboarding path due to their air-gapped environment. All steps in the standard guide are replaced by the procedure below.</p><h2>Step 1: On-site Installation</h2><p>Deploy the MSPByte on-prem agent to the MegaCorp DMZ server before attempting any API connections.</p><h2>Step 2: Firewall Allowlist</h2><p>Submit ticket to MegaCorp IT to allowlist MSPByte outbound IPs. Reference allowed IP list in the vault.</p>',
    type: 'replacement',
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-18T11:30:00Z',
  },
  // KB008 overrides
  {
    id: 'ov-008-acme',
    article_id: 'KB008',
    site_id: 'site-acme',
    site_name: 'Acme Corp',
    title: 'Acme Corp — FortiGate-Specific Rules',
    content:
      '<h2>FortiGate Policy Notes</h2><p>Acme Corp runs FortiGate 60F at all branch sites. Management access is via FortiManager — do not connect directly to the device CLI. All policy changes must be pushed through FortiManager and reviewed by the Acme NOC lead before activation.</p><h2>Custom Deny Rules</h2><p>Acme has added custom geo-blocking rules that deny all traffic from outside the US and EU. Do not remove these — they are a compliance requirement under their cyber insurance policy.</p>',
    type: 'addendum',
    locked_by: null,
    locked_at: null,
    updated_at: '2026-04-04T10:00:00Z',
  },
  {
    id: 'ov-008-pinnacle',
    article_id: 'KB008',
    site_id: 'site-pinnacle',
    site_name: 'Pinnacle LLC',
    title: 'Pinnacle LLC — Legacy pfSense Environment',
    content:
      '<h2>pfSense 2.6 Constraints</h2><p>Pinnacle LLC has not yet migrated to the new firewall hardware. Their current environment runs pfSense 2.6 on aging hardware — avoid firmware upgrades until the hardware refresh scheduled for Q3 2026.</p><p>The standard MSPByte management CIDR allowlist rule does not apply here. Instead, access is via a dedicated IPSEC tunnel from the MSPByte NOC. Credentials are in the vault under <em>Pinnacle / pfSense NOC Tunnel</em>.</p>',
    type: 'note',
    locked_by: 'Alex Chen',
    locked_at: '2026-04-08T11:15:00Z',
    updated_at: '2026-04-02T09:30:00Z',
  },
  {
    id: 'ov-008-techstart',
    article_id: 'KB008',
    site_id: 'site-techstart',
    site_name: 'TechStart Inc',
    title: 'TechStart — Cloud-Only, No On-Prem Firewall',
    content:
      '<h2>No Perimeter Firewall</h2><p>TechStart operates entirely in Azure. This runbook does not apply in its standard form. Instead, all firewall rules are managed through Azure Network Security Groups (NSGs) and Azure Firewall Premium.</p><p>Refer to the TechStart Azure runbook (internal doc) for NSG change procedures. The MSPByte management CIDR must be added to the <code>AllowMSPByteManagement</code> NSG rule in each subscription.</p>',
    type: 'replacement',
    locked_by: null,
    locked_at: null,
    updated_at: '2026-03-25T14:00:00Z',
  },
];

// ---- Article Versions ----

export const MOCK_ARTICLE_VERSIONS: WikiArticleVersion[] = [
  {
    id: 'ver-kb001-4',
    article_id: 'KB001',
    version_number: 4,
    change_note: 'Added DNS and related guides cross-references',
    changed_by: 'John Doe',
    created_at: '2026-04-07T09:00:00Z',
  },
  {
    id: 'ver-kb001-3',
    article_id: 'KB001',
    version_number: 3,
    change_note: 'Updated Datto RMM API key troubleshooting steps',
    changed_by: 'Jane Smith',
    created_at: '2026-03-20T15:30:00Z',
  },
  {
    id: 'ver-kb001-2',
    article_id: 'KB001',
    version_number: 2,
    change_note: 'Added prerequisites section and network access note',
    changed_by: 'Alex Chen',
    created_at: '2026-02-14T10:00:00Z',
  },
  {
    id: 'ver-kb001-1',
    article_id: 'KB001',
    version_number: 1,
    change_note: null,
    changed_by: 'John Doe',
    created_at: '2026-01-10T08:00:00Z',
  },
  // KB008 versions
  {
    id: 'ver-kb008-5',
    article_id: 'KB008',
    version_number: 5,
    change_note: 'Added change management section and post-incident note requirement',
    changed_by: 'Alex Chen',
    created_at: '2026-04-06T13:00:00Z',
  },
  {
    id: 'ver-kb008-4',
    article_id: 'KB008',
    version_number: 4,
    change_note: 'Expanded validation checklist with connectivity test commands',
    changed_by: 'Jane Smith',
    created_at: '2026-03-28T10:30:00Z',
  },
  {
    id: 'ver-kb008-3',
    article_id: 'KB008',
    version_number: 3,
    change_note: 'Added cross-references to KB004 and KB007',
    changed_by: 'Alex Chen',
    created_at: '2026-03-14T09:00:00Z',
  },
  {
    id: 'ver-kb008-2',
    article_id: 'KB008',
    version_number: 2,
    change_note: 'Clarified rule order and added management CIDR restriction note',
    changed_by: 'John Doe',
    created_at: '2026-02-20T14:00:00Z',
  },
  {
    id: 'ver-kb008-1',
    article_id: 'KB008',
    version_number: 1,
    change_note: null,
    changed_by: 'Alex Chen',
    created_at: '2026-01-22T11:00:00Z',
  },
];
