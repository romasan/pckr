import { v4 as uuid } from 'uuid';
import { IncomingMessage, ServerResponse } from 'http';
import packageFile from '../../package.json';
import {
	parseCookies,
} from '../helpers';
import { checkSession, addSession } from '../utils/sessions';
import { start } from './start';

const { server: { origin } } = require('../config.json');

const getInfo = (req: IncomingMessage, res: ServerResponse) => {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end(`pckr server v. ${packageFile.version}`);
};

const routes: Record<string, any> = {
	'/start': start,
};

export const webServerHandler = async (req: IncomingMessage, res: ServerResponse) => {
	res.setHeader('Access-Control-Allow-Origin', origin);
	res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

	if (req.method === 'OPTIONS') {
		res.writeHead(200);
		res.end();

		return;
	}

	let { token } = parseCookies(req.headers.cookie);

	if (!checkSession(token)) {
		const token = uuid();

		res.setHeader('Set-Cookie', `token=${token}; Max-Age=31536000; HttpOnly`);

		addSession(token);
	}

	try {
		const reqUrl = req?.url?.split('?')[0] as string;

		if (routes[reqUrl]) {
			routes[reqUrl](req, res);

			return;
		}

		getInfo(req, res);
	} catch (error) {
		try {
			res.writeHead(200);
			res.end('fail');
		} catch (ignire) {}

		console.log('Error: url handler', error);
	}
};
