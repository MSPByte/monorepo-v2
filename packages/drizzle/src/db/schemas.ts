import { pgSchema } from 'drizzle-orm/pg-core';

export const agentSchema = pgSchema('agent');
export const complianceSchema = pgSchema('compliance');
export const definitionsSchema = pgSchema('definitions');
export const auditSchema = pgSchema('audit');
export const ingestorSchema = pgSchema('ingestor');
export const vendorsSchema = pgSchema('vendors');
export const wikiSchema = pgSchema('wiki');
