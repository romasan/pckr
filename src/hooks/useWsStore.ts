import { useState, useEffect } from 'react';

import ee from '../lib/ee';


export const useWsStore = () => {
	const [wsStore, setWsStore] = useState<any>({
		foo: 123,
	});

	useEffect(() => {
		// ee.on('ws:init', onWsInit);

		return () => {
			// ee.off('ws:init', onWsInit);
		};
	}, []);

	return {
		wsStore,
	};
};
