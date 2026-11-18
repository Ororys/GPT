/** Target contracts only. Organizations never own a person's record by implication. */
export type OrganizationId = string & { readonly organizationId: unique symbol };
export interface Organization {
  id: OrganizationId;
  name: string;
}
export interface Membership {
  organizationId: OrganizationId;
  userId: string;
  role: 'member' | 'administrator';
  revokedAt: string | null;
}
