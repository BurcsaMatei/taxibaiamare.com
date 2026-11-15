export const SERVICE_TYPE_CODES = ["TAXI", "DELIVERY", "ROADSIDE"] as const;

export type ServiceTypeCode = (typeof SERVICE_TYPE_CODES)[number];

export function isServiceTypeCode(v: unknown): v is ServiceTypeCode {
  return typeof v === "string" && (SERVICE_TYPE_CODES as readonly string[]).includes(v);
}

export interface ServiceType {
  id: string;
  code: ServiceTypeCode;
  isActive: boolean;
}
