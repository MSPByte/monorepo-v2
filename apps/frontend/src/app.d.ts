/// <reference types="svelte-clerk/env" />
import { db, dbCatalog } from "$lib/db";

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: db.User;
      role: db.Role;
      org: dbCatalog.Org;
      connectionString: string;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
