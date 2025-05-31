import { IncomingMessage, ServerResponse } from 'http';

export const bet = (req: IncomingMessage, res: ServerResponse) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('ok');
};
