const { MessageBuilder, Format } = require('vkwrksps-bot');

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

// Нормализует входящий format: VK Teams может присылать строку JSON или готовый объект.
const normalizeFormat = (format) => {
    if (!format) return undefined;

    if (typeof format === 'string') {
        try {
            format = JSON.parse(format);
        } catch (error) {
            return undefined;
        }
    }

    return format;
};

// Проверяет, есть ли в формате хотя бы один валидный диапазон.
const isEmptyFormat = (format) => {
    return !Object.entries(format || {}).some(([, ranges]) =>
        Array.isArray(ranges) && ranges.some((r) => r && typeof r.offset === 'number' && r.length > 0)
    );
};

// Склеивает несколько частей текста вместе с их форматами в один текст
// и абсолютный формат (каждая часть: { text, format }, где format в координатах своей части).
const buildFormatted = (parts) => {
    let text = '';
    const format = {};

    for (const part of parts) {
        const shift = text.length;
        text += part.text;

        for (const [style, ranges] of Object.entries(part.format || {})) {
            if (!Array.isArray(ranges)) continue;
            if (!format[style]) format[style] = [];

            for (const range of ranges) {
                if (range && typeof range.offset === 'number' && range.length > 0) {
                    format[style].push({ ...range, offset: range.offset + shift });
                }
            }
        }
    }

    return { text, format: isEmptyFormat(format) ? undefined : format };
};

// Превращает объект формата в экземпляр Format для передачи в sendText (opts.format).
const formatFromObject = (format) => {
    if (isEmptyFormat(format)) return undefined;

    const messageFormat = new Format();

    for (const [style, ranges] of Object.entries(format)) {
        for (const range of ranges || []) {
            if (!range || typeof range.offset !== 'number' || !range.length) continue;

            const args = {};
            if (range.url) args.url = range.url;
            if (range.code) args.code = range.code;

            messageFormat.add(style, range.offset, range.length, Object.keys(args).length ? args : undefined);
        }
    }

    return messageFormat;
};

// Нормализует запись отчёта из файла: старая строка -> { text, format }.
const normalizeReportEntry = (entry) => {
    if (entry && typeof entry === 'object' && typeof entry.text === 'string') {
        return entry;
    }

    return { text: String(entry ?? ''), format: undefined };
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
    'zh ch sh sch x  ue a b v w g d e z i j k q l m n o p r s t u f h c y',
    'ж  ч  ш  щ   кс уэ а б в в г д е з и й к к л м н о п р с т у ф х ц я',
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
    normalizeFormat,
    isEmptyFormat,
    buildFormatted,
    formatFromObject,
    normalizeReportEntry,
    getDate,
    getTime,
    getTomorrow,
    isDayOff,
    getSlavicName,
    extractNumbers,
    uniq,
};
