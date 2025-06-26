const { MessageBuilder } = require('myteam-bot-sdk');

const formatNum = (number, keys) => {
    const mod100 = number % 100;
    const mod10 = number % 10;

    const index = (mod100 > 10 && mod100 < 20)
        ? 2
        : (mod10 === 1 ? 0 : (mod10 >= 2 && mod10 <= 4 ? 1 : 2));

    return `${number} ${keys[index]}`;
};

const formatDuration = (value, format = false) => {
    const hours = value % 8;
    const _days = Math.floor(value / 8);
    const days = _days % 5;
    const weeks = Math.floor(_days / 5);

    const long = `${weeks ? `${formatNum(weeks, ['неделя', 'недели', 'недель'])}` : ''}${days ? ` ${formatNum(days, ['день', 'дня', 'дней'])}` : ''}${hours ? ` ${formatNum(hours, ['час', 'часа', 'часов'])}` : ''}`.trim();
    const short = `${weeks ? `${weeks}w` : ''}${days ? ` ${days}d` : ''}${hours ? ` ${hours}h` : ''}`.trim();

    if (format === 'short') {
        return short;
    }

    if (format) {
        return long;
    }
    return `${long} (${short})`;
};

const parseBet = (text) => {
    const value = text
        .toLowerCase()
        .trim()
        .replace('-', ' ')
        .replace(/один|одна/im, '1')
        .replace(/пара|пару|два|две/im, '2')
        .replace(/три/im, '3')
        .replace(/четыре/im, '4')
        .replace(/пять/im, '5')
        .replace(/шесть/im, '6')
        .replace(/семь/im, '7')
        .replace(/восемь/im, '8')
        .replace(/девять/im, '9');
    let weeks = ~~value.toLowerCase().match(/(\d+)\s*[w|н]/i)?.[1];
    let days = ~~value.toLowerCase().match(/(\d+)\s*[d|д]/i)?.[1];
    let hours = ~~value.toLowerCase().match(/(\d+)\s*[h|ч]/i)?.[1];
    let sprints = ~~value.toLowerCase().match(/(\d+)\s*спринт/i)?.[1];

    if (!sprints && value.includes('спринт')) {
        sprints = 1;
    }

    if (!days && value.includes('день')) {
        days = 1;
    }

    weeks += (sprints * 2);

    if (text === 'неделя' || text === 'неделю') {
        weeks = 1;
    }

    if (text === 'день') {
        days = 1;
    }

    if (text === 'спринт') {
        weeks = 2;
    }

    if (!weeks && !days && !hours && String(parseInt(value)) === value) {
        hours = ~~value;
    }

    const totalHours = (weeks * 5 * 8) + (days * 8) + hours;

    return totalHours ? {
        weeks,
        days,
        hours,
        totalHours,
    } : 0;
};

const calc = (bets) => {
    const count = Object.keys(bets).length;
    const sorted = Object.values(bets).sort((a, b) => a > b ? 1 : -1);
    const mid = Math.ceil(sorted.reduce((s, e) => s + e, 0) / count);
    const med = sorted[Math.ceil(count / 2) - (count % 2)];

    return { count, mid, med };
};

const shiftFormat = (format, shift) => {
    return format
        ? Object.entries(format)
            .reduce(
                (list, [key, value]) => ({
                    ...list,
                    [key]: value.map(
                        (item) => ({
                            ...item,
                            ...(typeof item.offset === 'undefined' ? {} : { offset: Number(item.offset) + shift })
                        })
                    )
                }),
                {}
            )
        : format;
};

const formattedMessage = (text, format) => {
    const message = new MessageBuilder();

    message.textValue = text;
    message.format = format;

    return message;
};

const contextMessage = (text, context) => {
    const [prefix, postfix] = text.split('%s');

    return formattedMessage(`${prefix}${context.context}${postfix}`, shiftFormat(context.format, prefix.length));
};

module.exports = {
    formatNum,
	formatDuration,
    parseBet,
    calc,
    shiftFormat,
    formattedMessage,
    contextMessage,
};
