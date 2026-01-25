const { MyTeamSDK } = require('myteam-bot-sdk');
const fs = require('fs');

const {
	formatDuration,
	getDate,
	getTime,
	getTomorrow,
	isDayOff,
} = require('./utils');
require("dotenv").config();

const {
	VKTEAMS_TOKEN,
	VKTEAMS_API_URL,
	MASTER_CHAT_ID,
} = process.env;

let sdk;

const now = Date.now() + 1000;
const skip = {};
let bets = {};

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

const chatsFile = fs.createWriteStream(chatsFilePath, { flags : 'a' });
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

const spam = ({ sdk, chatId, context }) => {
	if (!context) {
		sdk.sendText(chatId, 'Пустое сообщение отменено');

		return;
	}

	IDs.forEach((chatId) => {
		sdk.sendText(chatId, context);
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

const report = ({ sdk, chatId }) => {
	const list = Object.entries(getReportFile())
		.filter(([key, value]) => Boolean(value));

	if (!list.length) {
		sdk.sendText(chatId, `⚙️ Ни кто ничего не написал`);

		return;
	}

	const text = list.map(([chatId, text]) => `\
================================
${chatId}
${text}`).join('\n')

	sdk.sendText(chatId, text);
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
	sdk = new MyTeamSDK({ token: VKTEAMS_TOKEN, baseURL: VKTEAMS_API_URL });

	console.log('Start chat bot', new Date().toGMTString());

	sdk.sendText(MASTER_CHAT_ID, `⚙️ Я жив!)`);

	sdk.on('newMessage', (event) => {
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
		} = event.payload;

		// fs.writeFileSync(__dirname + '/last-msg.json', JSON.stringify(event.payload, null, 2));

		console.log(`MESSAGE [${chatId}] ${new Date().toGMTString()}: "${text}"`);

		const isOwner = chatId === MASTER_CHAT_ID || isMod(chatId);
		const isChatParticipant = IDs.includes(chatId);

		try {
			const postfix = Array(4).fill().map(() => parseInt(Math.random() * 10)).join('');

			fs.writeFileSync(`${__dirname}/logs/${Date.now()}-${chatId}-${postfix}`, JSON.stringify(event.payload, null, 2));
		} catch (ignore) { }

		if (Date.now() <= now) {
			console.log(`SKIP from: ${chatId}; text: ${text}`);

			// if (!skip[chatId]) {
			// 	sdk.sendText(chatId, `Привет, я вернулся, если нужна моя помощь повтори сообщение`);
			// }

			skip[chatId] = true;

			return;
		}

		// const _text = text || event?.payload?.parts?.[0].payload?.message?.text || '';

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

	sdk.listen();
}

init();
