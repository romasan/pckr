import { IncomingMessage, ServerResponse } from 'http';

export const start = (req: IncomingMessage, res: ServerResponse) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('ok');
};
