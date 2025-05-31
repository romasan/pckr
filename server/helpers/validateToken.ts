export const validateToken = (token: string) => {
	return typeof token === 'string' && token.match(/^[0-9a-f][0-9a-f\-]{35}$/);
};
