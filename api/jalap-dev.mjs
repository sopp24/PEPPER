import handler from "../netlify/functions/jalap-dev.mjs";
import { createVercelBridge } from "../lib/vercel-bridge.mjs";
export default createVercelBridge(handler);
