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

const dow = [
    'вс',
    'пн',
    'вт',
    'ср',
    'чт',
    'пт',
    'сб',
    'вс',
];
const months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'май',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
];
const getDate = (date = new Date()) => {
    const key = `${months[date.getMonth()]}-${String(date.getDate()).padStart(2, '0')}`;

    return [key, dow[date.getDay()]]
};

const getTime = (date = new Date()) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getTomorrow = () => new Date(Date.now() + 86400000);

const isDayOff = (date = new Date()) => {
    const [, dow] = getDate(date);

    return ['сб', 'вс'].includes(dow);
}

module.exports = {
    formatNum,
	formatDuration,
    shiftFormat,
    formattedMessage,
    contextMessage,
    getDate,
    getTime,
    getTomorrow,
    isDayOff,
};
