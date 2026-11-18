/** Future explicit, time-bounded grant. Not enabled in the personal demo. */
import type { OrganizationId } from '../organizations/model';
export interface AccessGrant {
  id: string;
  personId: string;
  granteeUserId: string;
  organizationId: OrganizationId | null;
  scopes: ('documents:read' | 'observations:read' | 'activities:read')[];
  legalBasisReference: string;
  validFrom: string;
  validUntil: string;
  revokedAt: string | null;
}
