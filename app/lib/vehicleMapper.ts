import type { Vehicle as PrismaVehicle, VehicleStatus } from "../../generated/prisma/client";
import type { Vehicle, VehicleImage } from "../types";

export type PrismaVehicleWithLocation = PrismaVehicle & {
  location: { name: string };
};

function mapStatus(status: VehicleStatus): Vehicle["status"] {
  switch (status) {
    case "AVAILABLE": return "Available";
    case "PENDING": return "Reserved";
    case "SOLD": return "Sold";
    default: return "Available";
  }
}

export function mapPrismaVehicle(v: PrismaVehicleWithLocation, previousPrice?: number): Vehicle {
  return {
    id: v.id,
    slug: v.slug,
    make: v.make,
    model: v.model,
    variant: v.variant ?? undefined,
    year: v.year,
    bodyType: v.bodyType as Vehicle["bodyType"],
    price: v.price,
    previousPrice: previousPrice !== undefined && previousPrice > v.price ? previousPrice : undefined,
    priceNote: (v.priceNote ?? undefined) as Vehicle["priceNote"],
    odometerKm: v.odometerKm,
    transmission: v.transmission as Vehicle["transmission"],
    fuelType: v.fuelType as Vehicle["fuelType"],
    engineSizeCc: v.engineSizeCc ?? undefined,
    driveType: v.driveType as Vehicle["driveType"],
    colour: v.colour,
    doors: v.doors ?? undefined,
    seats: v.seats ?? undefined,
    vin: v.vin,
    importStatus: v.importStatus as Vehicle["importStatus"],
    condition: v.condition as Vehicle["condition"],
    features: v.features,
    images: (v.images as unknown as VehicleImage[]),
    description: v.description,
    location: v.location.name,
    locationId: v.locationId,
    status: mapStatus(v.status),
    inspectionReportUrl: v.inspectionReportUrl ?? undefined,
    financeEligible: v.financeEligible,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}
