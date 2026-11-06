import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}  (text_engine=${config.textEngine})`);
});
