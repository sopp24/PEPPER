import handler from "../netlify/functions/jalap.mjs";
import { createVercelBridge } from "../lib/vercel-bridge.mjs";
export default createVercelBridge(handler);
