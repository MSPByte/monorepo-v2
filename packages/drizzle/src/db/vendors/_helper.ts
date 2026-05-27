import { text, getTableConfig } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { vendorsSchema } from '../schemas.js';

type CustomField = {
  name: string;
  sql: string;
  join?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type?: any;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVendorStateView<T extends Record<string, any>>(
  tableColumns: T,
  baseTable: PgTable,
  viewName: string,
  entityType: string,
  options: {
    hasSite?: boolean;
    hasState?: boolean;
    namesOnly?: boolean;
    customFields?: CustomField[];
    groupBy?: boolean;
  } = {},
) {
  const {
    hasSite = true,
    hasState = true,
    namesOnly = false,
    customFields = [],
    groupBy = false,
  } = options;

  const extraColumns = {
    ...(hasState && !namesOnly ? { state: text('state') } : {}),
    link_name: text('link_name'),
    ...(hasSite ? { site_name: text('site_name') } : {}),
    ...Object.fromEntries(customFields.map(({ name, type = text(name) }) => [name, type])),
  };

  const allColumns = { ...tableColumns, ...extraColumns };

  const selectParts: string[] = ['e.*'];

  if (hasState && !namesOnly) {
    selectParts.push(`
      case
        when agg.max_severity >= 3 then 'critical'::text
        when agg.max_severity = 2 then 'warn'::text
        when agg.max_severity = 1 then 'low'::text
        else 'normal'::text
      end as state
    `);
  }

  selectParts.push('il.name as link_name');
  if (hasSite) selectParts.push('s.name as site_name');

  customFields.forEach(({ name, sql: fieldSql }) => {
    selectParts.push(`${fieldSql} as ${name}`);
  });

  const tableConfig = getTableConfig(baseTable);
  const schemaName = tableConfig.schema ?? 'vendors';

  let joins = `left join public.integration_links il on il.id = e.link_id`;

  customFields
    .filter((c) => c.join)
    .forEach(({ join: joinSql }) => {
      joins += `\n    ${joinSql}`;
    });

  if (hasSite) {
    joins += `\n    left join public.sites s on s.id = e.site_id`;
  }

  if (hasState) {
    joins += `
    left join lateral (
      select max(d.severity) as max_severity
      from public.alerts d
      where d.entity_id = e.id::text
        and d.entity_type = '${entityType}'
        and d.status = 'active'::text
    ) agg on true`;
  }

  const groupByClause = groupBy
    ? `group by e.id, il.name${hasSite ? ', s.name' : ''}`
    : '';

  const query = sql.raw(`
    select
      ${selectParts.join(',\n      ')}
    from ${schemaName}.${tableConfig.name} e
    ${joins}
    ${groupByClause}
  `);

  return vendorsSchema.view(viewName, allColumns).as(query);
}
