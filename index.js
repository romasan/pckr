const { MyTeamSDK } = require('myteam-bot-sdk');
const fs = require('fs');

const {
    formatNum,
    formatDuration,
    parseBet,
    calc,
    shiftFormat,
    contextMessage,
} = require('./utils');
require("dotenv").config();

const {
    VKTEAMS_TOKEN,
    VKTEAMS_API_URL,
    MASTER_CHAT_ID,
} = process.env;

const now = Date.now() + 1000;
const skip = {};
let current = null;
let bets = {};

const chatsFilePath = __dirname + '/chats.log';
const historyFilePath = __dirname + '/history.log';

if (!fs.existsSync(chatsFilePath)) {
    fs.writeFileSync(chatsFilePath, '');
}

if (!fs.existsSync(historyFilePath)) {
    fs.writeFileSync(historyFilePath, '');
}

let IDs = fs.readFileSync(chatsFilePath)
    .toString()
    .split('\n')
    .filter(Boolean)
    .reduce((list, item) => (list.includes(item) ? list : [...list, item]), []);

const chatsFile = fs.createWriteStream(chatsFilePath, { flags : 'a' });
const historyFile = fs.createWriteStream(historyFilePath, { flags : 'a' });

const spam = (sdk, text) => {
    IDs.forEach((chatId) => {
        sdk.sendText(chatId, text);
    });
};

const start = async ({ sdk, chatId, type }) => {
    const prefix = 'Привет, я помогу в оценке задачек.';
    const text = current
        ? contextMessage(`${prefix}\nСейчас нужно твоё мнение по задачке:\n%s`, current)
        : `${prefix}\nСейчас нет задачек которые бы требовали оценки.`;

    setTimeout(() => {
        sdk.sendText(chatId, text);
    }, 1000);

    if (!IDs.includes(chatId)) {
        IDs.push(chatId);
        chatsFile.write(chatId + '\n');
        sdk.sendText(MASTER_CHAT_ID, `⚙️ Новый участник: ${chatId}`);
    }
};

const help = async ({ sdk, chatId, context }) => {
    const isOwner = chatId === MASTER_CHAT_ID;

    if (isOwner) {
        sdk.sendText(chatId, `⚙️ команды для модерации:
/new - новая задачка на оценку
/end - закончить оценку
/list - список оценок по текущей задачке
/history - последние голосования
/members - список участников`);
    }
};

const history = async ({ sdk, chatId, context }) => {
    let index = isNaN(parseInt(context)) ? -1 : parseInt(context);
    const history = fs.readFileSync(historyFilePath)
        .toString()
        .split('\n')
        .filter(Boolean);

    if (index < 0) {
        index = history.length - 1;
    }

    try {
        const json = JSON.parse(history[index])

        sdk.sendText(chatId, `⚙️ Task #${index} of ${history.length}\n\`\`\`\n${JSON.stringify(json, null, 2)}\n\`\`\``);
    } catch (error) {
        sdk.sendText(chatId, `⚙️ Error: ${error}`);
    }
};

const list = ({ sdk, chatId, context }) => {
    sdk.sendText(
        chatId,
        '⚙️ Список оценок:\n' + (Object.entries(bets)
            .map(([chatId, value]) => `[${chatId}]: ${formatDuration(value, true)}`)
            .join('\n') ||
        'Пока никто не проголосовал')
    );
};

const add = async ({ sdk, chatId, format, command, context }) => {
    if (!context) {
        sdk.sendText(chatId, `⚙️ Ошибка: пустой запрос`);

        return;
    }

    format = shiftFormat(format, -(command.length + 2));
    current = {
        format,
        context,
    };
    bets = {};

    const message = contextMessage('🫵 Нужна твоя оценка по задачке:\n%s', current);

    spam(sdk, message);
};

const end = async ({ sdk, chatId, context }) => {
    if (!current) {
        sdk.sendText(chatId, `⚙️ Ошибка: пустой запрос`);

        return;
    }
    const { count, mid, med } = calc(bets);
    const total = IDs.length;

    const message = contextMessage(`✅ Вот и оценили задачку:\n%s\n\nПроголосовали ${count} из ${total}\n\nСредняя арифметическая оценка: ${formatDuration(mid, true)}\nМедианная оценка: ${formatDuration(med, true)}\n\n${formatDuration(med, 'short')}`, current);
    spam(sdk, message);

    historyFile.write(JSON.stringify({
        task: current.context
            .replace('\n', ' ')
            .trim(),
        bets,
        count,
        total: Object.keys(IDs).length,
        mid,
        med,
        time: new Date().toGMTString(),
    }) + '\n');

    current = null;
    bets = {};
};

const members = async ({ sdk, chatId, context }) => {
    sdk.sendText(chatId, '⚙️ Участники оценки:\n' + IDs.join('\n'));
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
    // sdk.sendText(MASTER_CHAT_ID, `⚙️ Участник [${context}] вышел из рассылки по команде /stop`);
};

const commands = {
	start,
	help,
    stop,
};

const masterCommands = {
    add,
    new: add,
    end,
    fin: end,
    close: end,
    list,
    history,
    his: history,
    members,
    kick,
};

const init = () => {
	const sdk = new MyTeamSDK({ token: VKTEAMS_TOKEN, baseURL: VKTEAMS_API_URL });

    console.log('Start chat bot', new Date().toGMTString());

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

        const isOwner = chatId === MASTER_CHAT_ID;
        const isChatParticipant = IDs.includes(chatId);

		try {
			const postfix = Array(4).fill().map(() => parseInt(Math.random() * 10)).join('');

			fs.writeFileSync(`${__dirname}/logs/${Date.now()}-${chatId}-${postfix}`, JSON.stringify(event.payload, null, 2));
		} catch (ignore) {}

		if (Date.now() <= now) {
			console.log(`SKIP from: ${chatId}; text: ${text}`);

			if (!skip[chatId]) {
				// sdk.sendText(chatId, `Привет, я вернулся, если нужна моя помощь повтори сообщение`);
			}

			skip[chatId] = true;

			return;
		}

		// const _text = text || event?.payload?.parts?.[0].payload?.message?.text || '';

		const [, _command, context] = (text || '').match(/^\/(\w+)[\s\n]?([\w\W]+)?/) || [];
		const command = _command?.toLowerCase();
	
		if (commands[command]) {
			commands[command]({ sdk, text, msgId, chatId, type, userId, format, command, context });

			return;
		}

		if (isOwner && masterCommands[command]) {
			masterCommands[command]({ sdk, text, msgId, chatId, type, userId, format, command, context });

			return;
		}

        if (!isChatParticipant) {
            // sdk.sendText(chatId, '/start - для участия в оценке задач');

            return;
        }

        if (!current) {
            sdk.sendText(chatId, 'Сейчас нет задачек которые бы требовали оценки.');

            return;
        }

		const bet = parseBet(text || '');

		if (bet) {
            const { weeks, days, hours, totalHours } = bet;
            const count = Object.keys(bets).length;
            const total = IDs.length;

            const inputDuration = `${weeks ? `${formatNum(weeks, ['неделя', 'недели', 'недель'])}` : ''}${days ? ` ${formatNum(days, ['день', 'дня', 'дней'])}` : ''}${hours ? ` ${formatNum(hours, ['час', 'часа', 'часов'])}` : ''}`.trim();
            const formattedDuration = formatDuration(totalHours, true);
            const duration = inputDuration === formattedDuration
                ? inputDuration
                : `${inputDuration} (${formattedDuration})`;

            sdk.sendText(MASTER_CHAT_ID, `⚙️ [${chatId}] сделал оценку:\n${duration}\n${count} / ${total}`);

            if (totalHours < 0 || totalHours > 1920) {
                sdk.sendText(chatId, `👀 Какой-то странный срок:\n${duration}\nтакой ответ я не могу принять.`);

                return;
            }

            bets[chatId] = totalHours;

            if (!isOwner) {
                sdk.sendText(chatId, `👍 Принял твою оценку:\n${duration}`);
            }
		} else {
			sdk.sendText(chatId, `⛔ Не совсем тебя понял, я принимаю ответы в разных форматах, например:
1w 2d 3h
2d3h
1w.2d.3h.
1 неделя 2 дня 3 часа
1н. 2д. 3ч.
1 нед 2 дн 3 ч
и т.д.`);
		}
	});
	
	sdk.listen();
}

init();
