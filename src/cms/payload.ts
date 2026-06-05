import config from "@payload-config";
import { getPayload } from "payload";

export async function getCmsPayload() {
  return getPayload({ config });
}
