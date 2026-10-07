import { app } from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 5001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`RouteShield AI Backend running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Notice: Fictional demonstration network — not live navigation.`);
});
