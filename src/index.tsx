import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { start } from './lib/api';
import { connect as connectWS } from './lib/ws';

const connectAPI = () => {
	start()
		.then((text) => {
			if (text === 'fail') {
				document.location.reload();

				return;
			}

			connectWS(text);
		})
		.catch(() => {});
};

connectAPI();

const container = document.getElementById('root') as HTMLElement;

createRoot(container).render(<App />);
