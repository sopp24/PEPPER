import handler from "../netlify/functions/transport-status.mjs";
import { createVercelBridge } from "../lib/vercel-bridge.mjs";
export default createVercelBridge(handler);
