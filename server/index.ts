import { initServer } from './utils/ws';
import { webServerHandler } from './api';

initServer(webServerHandler);
