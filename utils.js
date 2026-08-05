const { MessageBuilder } = require('vkwrksps-bot');

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

const pipe = (value, ...cb) => cb.reduce((acc, fn) => fn(acc), value);

const getName = (chatId) => chatId
    .split('@')
    .shift()
    .split('.')
    .pop();

const dict = [
    'zh ch sh sch x  a b v w g d e z i j k q l m n o p r s t u f h c y',
    'ж  ч  ш  щ   кс а б в в г д е з и й к к л м н о п р с т у ф х ц я',
].reduce((a, b) => {
    a = a.split(/\s+/);
    b = b.split(/\s+/);

    return a.map((e, i) => [e, b[i]])
});

const slavic = (name) => dict.reduce((name, [a, b]) => name.replace(new RegExp(a, 'ig'), b), name);

const upFirstLetter = (name) => name.slice(0, 1).toUpperCase() + name.slice(1).toLowerCase();

const getSlavicName = (chatId) => pipe(
    chatId,
    getName,
    slavic,
    upFirstLetter,
);

const extractNumbers = (text) => (text.match(/\d+/g) || []).map(Number);

const uniq = (arr) => arr.reduce((list, item) => (list.includes(item) ? list : list.concat(item)), []);

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
    getSlavicName,
    extractNumbers,
    uniq,
};
