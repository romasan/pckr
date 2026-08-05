const { Bot, Format } = require('vkwrksps-bot');
const fs = require('fs');
const http = require('http');

// Не даём процессу упасть из-за необработанных ошибок
// (например, когда сервер/прокси отвечает HTML вместо JSON)
process.on('unhandledRejection', (error) => {
	console.error('[unhandledRejection]', error?.message || error);
});

process.on('uncaughtException', (error) => {
	console.error('[uncaughtException]', error?.message || error);
});

const {
	getDate,
	getTime,
	getTomorrow,
	isDayOff,
	getSlavicName,
	// extractNumbers,
	// uniq,
} = require('./utils');
// const { getIssueData } = require('./jira');
require("dotenv").config();

const {
	VKTEAMS_TOKEN,
	VKTEAMS_API_URL,
	MASTER_CHAT_ID,
	WEB_SERVER_HOST,
	WEB_SERVER_PORT,
} = process.env;

let sdk;

const now = Date.now() + 1000;
const skip = {};

const alarmClock = {
	'11:15': '',
};

const chatsFilePath = __dirname + '/chats.log';
const modsFilePath = __dirname + '/mods.log';
const historyFilePath = __dirname + '/history.log';

if (!fs.existsSync(chatsFilePath)) {
	fs.writeFileSync(chatsFilePath, '');
}

if (!fs.existsSync(modsFilePath)) {
	fs.writeFileSync(modsFilePath, '');
}

if (!fs.existsSync(historyFilePath)) {
	fs.writeFileSync(historyFilePath, '');
}

let IDs = fs.readFileSync(chatsFilePath)
	.toString()
	.split('\n')
	.filter(Boolean)
	.reduce((list, item) => (list.includes(item) ? list : [...list, item]), []);

const checkAlarmClock = () => {
	if (isDayOff()) {
		return;
	}

	const [day] = getDate();
	const time = getTime();

	for (const key in alarmClock) {
		if (alarmClock[key] !== day && key <= time) {
			alarmClock[key] = day;

			const reports = getReportFile();

			for (const chatId of IDs) {
				if (!reports[chatId]) {
					sdk.sendText(chatId, `Привет!
Расскажи чем занимался вчера и чем планируешь заниматься сегодня, если есть какие-то вопросы или проблемы обсудим их на дейлике.
Если есть вопросы по работе бота с этим поможет команда /help`);
				}
			}
		}
	}
};

setInterval(checkAlarmClock, 1000);

let modIDs = fs.readFileSync(modsFilePath)
	.toString()
	.split('\n')
	.filter(Boolean)
	.reduce((list, item) => (list.includes(item) ? list : [...list, item]), []);

const chatsFile = fs.createWriteStream(chatsFilePath, { flags: 'a' });
const modsFile = fs.createWriteStream(modsFilePath, { flags: 'a' });

const addMod = (chatId) => {
	if (!modIDs.includes(chatId)) {
		modIDs.push(chatId);
		modsFile.write(chatId + '\n');
	}
};

const kickMod = (chatId) => {
	modIDs = modIDs.filter((item) => item !== chatId).filter(Boolean);
	fs.writeFileSync(chatsFilePath, modIDs.join('\n') + '\n');
};

const isMod = (chatId) => {
	return modIDs.includes(chatId);
};

const shiftFormat = (format, shift) => {
	if (!format) {
		return undefined;
	}

	return Object.entries(format)
		.filter(([, ranges]) => Array.isArray(ranges) && ranges.length)
		.reduce((result, [type, ranges]) => {
			result[type] = ranges
				.map((range) => ({ ...range, offset: range.offset - shift }))
				.filter((range) => range.offset >= 0);

			return result;
		}, {});
};

const spam = ({ sdk, chatId, text, context, format }) => {
	if (!context) {
		sdk.sendText(chatId, 'Пустое сообщение отменено');

		return;
	}

	const shift = text.length - context.length;
	const shiftedFormat = shiftFormat(format, shift);

	const opts = {};

	if (shiftedFormat && Object.keys(shiftedFormat).length) {
		const messageFormat = new Format();

		for (const [style, ranges] of Object.entries(shiftedFormat)) {
			for (const range of ranges) {
				const args = {};

				if (range.url) {
					args.url = range.url;
				}

				if (range.code) {
					args.code = range.code;
				}

				messageFormat.add(style, range.offset, range.length, Object.keys(args).length ? args : undefined);
			}
		}

		opts.format = messageFormat;
	}

	IDs.forEach((chatId) => {
		sdk.sendText(chatId, context, opts);
	});
};

const spamMods = (sdk, text) => {
	const ids = isMod(MASTER_CHAT_ID)
		? modIDs
		: [...modIDs, MASTER_CHAT_ID];

	ids.forEach((chatId) => {
		sdk.sendText(chatId, text);
	});
};
const start = async (attrs) => {

	const { sdk, chatId } = attrs;

	if (!IDs.includes(chatId)) {
		IDs.push(chatId);
		chatsFile.write(chatId + '\n');
		sdk.sendText(MASTER_CHAT_ID, `⚙️ Новый участник: ${chatId}`);
	}

	setTimeout(() => {
		help(attrs);
	}, 1000);
};

const help = async ({ sdk, chatId, isOwner }) => {
	if (isOwner) {
		sdk.sendText(chatId, `\
⚙️ команды для модерации:
/members - список участников
/kick - отключить участника из опроса
/mod - добавить модератора
/unmod - исключить из списка модераторов
/mods - список модераторов
/list - список заполнивших отчёт
/spam - массовая рассылка
/report - отчёт
`);
		// return;
	}

	sdk.sendText(chatId, `\
Чтобы рассказать чем занимался вчера и чем планируешь заняться сегодня, просто напиши этот в чат в любом формате.
Можно ответить как одним так и несколькими сообщениями, каждое следующее будет добавлено к предыдущему.

/reset - очистить предыдущий ответ и заполнить по новой
/view - посмотреть свой ответ целиком
/tomorrow - если начать сообшение с этой команды можно заранее заполнить опрос на завтра
/help - вывести это сообшене снова`);
};

const mod = async ({ sdk, chatId, context }) => {
	if (!context) {
		await sdk.sendText(chatId, `⚙️ нужно ввести ID участника, например:\n\`/mod foo@bar\`\nвот список участников опроса:\n${IDs.join('\n')}`);

		return;
	}

	if (!IDs.includes(context)) {
		await sdk.sendText(chatId, `⚙️ "${context}" не является участником чата`);

		return;
	}

	if (modIDs.includes(context)) {
		await sdk.sendText(chatId, `⚙️ "${context}" уже является модератором`);

		return;
	}

	addMod(context);

	await sdk.sendText(chatId, `⚙️ "${context}" добавлен(а) в модераторы`);
	await sdk.sendText(context, `⚙️ теперь ты являешься модератором и можешь добавлять задачи для оценки\n/help - получение списка доступных команд`);
};

const unmod = async ({ sdk, chatId, context }) => {
	if (!context) {
		await sdk.sendText(chatId, `⚙️ нужно ввести ID модератора, например:\n\`/unmod foo@bar\`\nвот список модераторов опроса:\n${modIDs.join('\n') || 'пока нет модераторов'}`);

		return;
	}

	if (!IDs.includes(context)) {
		await sdk.sendText(chatId, `⚙️ "${context}" не является участником чата`);

		return;
	}

	if (!modIDs.includes(context)) {
		await sdk.sendText(chatId, `⚙️ "${context}" не является модератором`);

		return;
	}

	kickMod(context);

	await sdk.sendText(chatId, `⚙️ "${context}" исключен(а) из модераторов`);
};

const mods = async ({ sdk, chatId }) => {
	if (modIDs.length === 0) {
		await sdk.sendText(chatId, `⚙️ пока нет ни одного модератора`);

		return;
	}

	await sdk.sendText(chatId, `⚙️ Список модераторов:\n${modIDs.join('\n')}`);
};

const list = ({ sdk, chatId, context }) => {
	const list = Object.entries(getReportFile())
		.filter(([key, value]) => Boolean(value))
		.map(([key, value]) => key);

	if (!list.length) {
		sdk.sendText(chatId, '⚙️ Пока никто ничего не написал');

		return;
	}

	sdk.sendText(chatId, `⚙️\n${list.join('\n')}`);
};

const getReportFile = (tomorrow) => {
	const [key] = getDate(tomorrow ? getTomorrow() : undefined);
	const filePath = __dirname + '/days/' + key + '.json';
	let data = {};

	if (fs.existsSync(filePath)) {
		try {
			const json = fs.readFileSync(filePath).toString();

			data = JSON.parse(json);
		} catch (error) { }
	}

	return data;
}

const setReportFileForClient = (chatId, text, tomorrow) => {
	const [key] = getDate(tomorrow ? getTomorrow() : undefined);
	const filePath = __dirname + '/days/' + key + '.json';

	fs.writeFileSync(filePath, JSON.stringify({
		...getReportFile(tomorrow),
		[chatId]: text,
	}));
}

const cleanReportFileForClient = (chatId, tomorrow) => {
	setReportFileForClient(chatId, '', tomorrow);
}

const appendReportFileForClient = (chatId, text, tomorrow) => {
	const prev = getReportFile(tomorrow)[chatId] || '';

	setReportFileForClient(chatId, [prev, text].filter(Boolean).join('\n'), tomorrow);
}

const addReport = async ({ sdk, chatId, text }) => {
	try {
		if (!text) {
			sdk.sendText(chatId, `Кажется ты ничего не написал (если ты отправил картинку или файл я пока не умею работать с таким)`);

			return;
		}

		appendReportFileForClient(chatId, text);
	} catch (error) {
		sdk.sendText(MASTER_CHAT_ID, `⚙️ У ${chatId} что-то пошло не так\n${error}`);
		sdk.sendText(chatId, `Что-то пошло не так( уже сообщил об этом администратору бота.`);

		return;
	}

	sdk.sendText(chatId, `\
Принял твой ответ.
/help поможет если есть вопросы`);

	sdk.sendText(MASTER_CHAT_ID, `⚙️ ${chatId} рассказал чем занимался.`);
};

const reset = async ({ sdk, chatId, context }) => {
	try {
		cleanReportFileForClient(chatId, context === 'tomorrow');
	} catch (error) {
		sdk.sendText(MASTER_CHAT_ID, `⚙️ У ${chatId} что-то пошло не так\n${error}`);
		sdk.sendText(chatId, `Что-то пошло не так( уже сообщил об этом администратору бота.`);

		return;
	}

	sdk.sendText(chatId, `Готово, теперь можно начаь с чистого листа.`);

	sdk.sendText(MASTER_CHAT_ID, `⚙️ ${chatId} очистил рассказ о проделанной работе`);
};

const view = async ({ sdk, chatId, context }) => {
	try {
		const text = getReportFile(context === 'tomorrow')?.[chatId];

		if (!text) {
			sdk.sendText(chatId, `Ты сегодня ещё ничего не писал`);

			return;
		}

		sdk.sendText(chatId, `Вот твои сообщения отправленные сегодня:\n${text}`);
	} catch (error) {
		sdk.sendText(MASTER_CHAT_ID, `⚙️ У ${chatId} что-то пошло не так\n${error}`);
		sdk.sendText(chatId, `Что-то пошло не так( уже сообщил об этом администратору бота.`);
	}
};

const tomorrow = async ({ sdk, chatId, context }) => {
	try {
		if (!context) {
			sdk.sendText(chatId, `Кажется ты ничего не написал`);

			return;
		}
		appendReportFileForClient(chatId, context, true);
	} catch (error) {
		sdk.sendText(MASTER_CHAT_ID, `⚙️ У ${chatId} что-то пошло не так\n${error}`);
		sdk.sendText(chatId, `Что-то пошло не так( уже сообщил об этом администратору бота.`);

		return;
	}

	sdk.sendText(chatId, `\
Принял твой ответ на завтра.
можно посмотреть его командой
\`\`\`
/view tomorrow
\`\`\`
или очистить с помощью
\`\`\`
/reset tomorrow
\`\`\`
/help поможет если есть вопросы`);

	sdk.sendText(MASTER_CHAT_ID, `⚙️ ${chatId} заранее приготовил отчёт на завтра`);
};

function replaceMentionedTasks(text, tasks) {
	// Словарь для быстрого поиска задачи по ключу
	const taskDict = {};
	for (const task of tasks) {
		taskDict[task.issueKey] = task;
	}

	// Регулярка для поиска строк "Упомянутые таски: ..."
	const pattern = /^(Упомянутые таски:)\s*(.*)$/gm;

	// Функция замены
	function replacer(match, prefix, keysStr, offset, input) {
		// Извлекаем все VKPL-xxxx из строки
		const keys = (keysStr.match(/\bVKPL-\d+\b/g) || []);
		let result = '';
		for (const key of keys) {
			const task = taskDict[key];
			if (task) {
				result += `${key}: ${task.summary} [${task.performer}] (${task.status})\n`;
			}
		}
		return result;
	}

	// Заменяем все подходящие строки
	return text.replace(pattern, replacer);
}

const report = async ({ sdk, chatId }) => {
	const list = Object.entries(getReportFile())
		.filter(([key, value]) => Boolean(value));

	if (!list.length) {
		sdk.sendText(chatId, `⚙️ Ни кто ничего не написал`);

		return;
	}

	// let issuesList = [];

	let text = `Заполнили отчёт: ${list.length} / ${IDs.length}\n\n`;
	text += list
		.map(([chatId, text]) => [getSlavicName(chatId), text])
		.sort(([a], [b]) => a > b ? 1 : -1)
		.map(([chatId, text]) => `${chatId}\n${text}`)
		// .map((text) => {
		// 	const issues = extractNumbers(text)
		// 		.filter((num) => num > 1000)
		// 		.map((num) => `VKPL-${num}`);

		// 	issuesList = issuesList.concat(issues);

		// 	return issues.length ? `${text}\n---\nУпомянутые таски: ${issues.join(', ')}` : text;
		// })
		.join('\n\n')

	const msg = await sdk.sendText(chatId, text);

	// const issuesData = await Promise.all(uniq(issuesList).map(getIssueData));

	// text = replaceMentionedTasks(text, issuesData);

	// sdk.editText(chatId, msg, text);
};

const members = async ({ sdk, chatId, context }) => {
	sdk.sendText(chatId, '⚙️ Участники:\n' + IDs.join('\n'));
};

const kick = ({ sdk, chatId, context }) => {
	if (!IDs.includes(context)) {
		sdk.sendText(chatId, `⚙️ Нет такого участника: "${context}"`);

		return;
	}

	IDs = IDs.filter((item) => item !== context).filter(Boolean);
	fs.writeFileSync(chatsFilePath, IDs.join('\n') + '\n');
	sdk.sendText(chatId, `⚙️ Участник [${context}] удалён из рассылки.\nСписок участников:\n${IDs.join('\n')}`);
};

const stop = async ({ sdk, chatId, context }) => {
	IDs = IDs.filter((item) => item !== chatId).filter(Boolean);
	fs.writeFileSync(chatsFilePath, IDs.join('\n') + '\n');
	if (chatId !== MASTER_CHAT_ID) {
		sdk.sendText(MASTER_CHAT_ID, `⚙️ Участник [${context}] вышел из рассылки по команде /stop`);
	}
};

const commands = {
	start,
	help,
	stop,
	view,
	reset,
	tomorrow,
};

const masterCommands = {
	list,
	members,
	kick,
	mod,
	unmod,
	mods,
	spam,
	report,
};

const init = () => {
	// Нормализуем URL (убираем завершающий слэш), чтобы избежать двойных слэшей в запросах.
	sdk = new Bot({ token: VKTEAMS_TOKEN, apiUrl: VKTEAMS_API_URL.replace(/\/+$/, '') });

	console.log('Start chat bot', new Date().toGMTString());

	sdk.sendText(MASTER_CHAT_ID, `⚙️ Я жив!)`);

	sdk.onMessage((event) => {
		const {
			text,
			format,
			msgId,
			chat: {
				chatId,
				type,
			},
			from: {
				userId,
			},
		} = event.data;

		// fs.writeFileSync(__dirname + '/last-msg.json', JSON.stringify(event.data, null, 2));

		console.log(`MESSAGE [${chatId}] ${new Date().toGMTString()}: "${text}"`);

		const isOwner = chatId === MASTER_CHAT_ID || isMod(chatId);
		const isChatParticipant = IDs.includes(chatId);

		try {
			const postfix = Array(4).fill().map(() => parseInt(Math.random() * 10)).join('');

			fs.writeFileSync(`${__dirname}/logs/${Date.now()}-${chatId}-${postfix}`, JSON.stringify(event.data, null, 2));
		} catch (ignore) { }

		if (Date.now() <= now) {
			console.log(`SKIP from: ${chatId}; text: ${text}`);

			// if (!skip[chatId]) {
			// 	sdk.sendText(chatId, `Привет, я вернулся, если нужна моя помощь повтори сообщение`);
			// }

			skip[chatId] = true;

			return;
		}

		// const _text = text || event?.data?.parts?.[0].payload?.message?.text || '';

		const [, _command, context] = (text || '').match(/^\/(\w+)[\s\n]?([\w\W]+)?/) || [];
		const command = _command?.toLowerCase();
		const attrs = { sdk, text, msgId, chatId, type, userId, format, command, context, isOwner };

		if (commands[command]) {
			commands[command](attrs);

			return;
		}

		if (isOwner && masterCommands[command]) {
			masterCommands[command](attrs);

			return;
		}

		if (!isChatParticipant) {
			// sdk.sendText(chatId, '/start - для участия в оценке задач');

			return;
		}

		addReport(attrs);
	});

	sdk.startPolling();

	// ---

	const callback = async (req, res) => {
		console.log('==== origin:', req?.headers?.['origin']);
		console.log('==== url:', req?.url);

		res.setHeader('Access-Control-Allow-Origin', req?.headers?.['origin'] || '*');
		res.setHeader('Access-Control-Allow-Credentials', 'true');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

		if (req?.url === '/report') {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({
				total: IDs.length,
				data: getReportFile(),
			}));

			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.end('{"debug": "=)"}');
	};

	const webServer = http.createServer(callback);

	console.log('Start web server', new Date().toGMTString(), 'on', WEB_SERVER_HOST, WEB_SERVER_PORT);

	webServer.listen(WEB_SERVER_PORT, WEB_SERVER_HOST);
}

init();
