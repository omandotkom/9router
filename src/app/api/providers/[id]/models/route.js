import { NextResponse } from "next/server";
import {
  getProviderConnectionById,
  updateProviderConnection,
  getProviderConnections,
} from "@/lib/localDb";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { modelId, disabled } = body;

    if (typeof modelId !== "string" || modelId.trim() === "") {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    const connection = await getProviderConnectionById(id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const disabledModels = connection.providerSpecificData?.disabledModels || [];

    let updatedDisabledModels;
    if (disabled === true) {
      if (!disabledModels.includes(modelId)) {
        updatedDisabledModels = [...disabledModels, modelId];
      } else {
        updatedDisabledModels = disabledModels;
      }
    } else {
      updatedDisabledModels = disabledModels.filter(m => m !== modelId);
    }

    const updated = await updateProviderConnection(id, {
      providerSpecificData: {
        ...(connection.providerSpecificData || {}),
        disabledModels: updatedDisabledModels,
      },
    });

    return NextResponse.json({ connection: updated });
  } catch (error) {
    console.log("Error toggling model disabled:", error);
    return NextResponse.json({ error: "Failed to toggle model" }, { status: 500 });
  }
}
