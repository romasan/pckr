// Генерация HTML-отчёта по ежедневным отчётам участников.
// Используется командой /report: после текстовой сводки бот отправляет этот отчёт файлом.

// Экранирование HTML-спецсимволов в пользовательских данных.
// \n кодируем сущностью, чтобы в HTML-атрибутах переносы строк не терялись.
function escapeHtml(str) {
	const amp = '&' + 'amp;';
	const lt = '&' + 'lt;';
	const gt = '&' + 'gt;';
	const quot = '&' + 'quot;';
	const hash39 = '&#' + '39;';
	const hash10 = '&#' + '10;';
	return String(str ?? '')
		.replace(/&/g, amp)
		.replace(/</g, lt)
		.replace(/>/g, gt)
		.replace(/"/g, quot)
		.replace(/'/g, hash39)
		.replace(/\n/g, hash10)
		.replace(/\r/g, '');
}

// Теги HTML для простых стилей форматирования VK Teams.
const STYLE_TAGS = {
	bold: 'b',
	italic: 'i',
	underline: 'u',
	strikethrough: 's',
	inline_code: 'code',
	pre: 'code',
	quote: 'blockquote',
};

// Рендерит текст с учётом форматирования (ссылки, жирность, курсив, код и т.д.).
// Ссылки (style === 'link' с url) становятся кликабельными <a>, вложенные стили сохраняются.
// Сегменты текста строятся по границам всех диапазонов формата, поэтому пересечения
// и вложенность стилей обрабатываются корректно.
function renderRichText(text, format) {
	const str = String(text ?? '');
	if (!str) return '';

	const points = new Set([0, str.length]);

	for (const ranges of Object.values(format || {})) {
		for (const r of ranges || []) {
			if (r && typeof r.offset === 'number') {
				points.add(Math.max(0, r.offset));
				points.add(Math.min(str.length, r.offset + (r.length || 0)));
			}
		}
	}

	const boundaries = [...points].sort((a, b) => a - b);
	let html = '';

	for (let i = 0; i < boundaries.length - 1; i++) {
		const start = boundaries[i];
		const end = boundaries[i + 1];

		if (start >= end) continue;

		let linkUrl = null;
		const tags = [];

		for (const [style, ranges] of Object.entries(format || {})) {
			for (const r of ranges || []) {
				if (r && typeof r.offset === 'number') {
					const rStart = r.offset;
					const rEnd = r.offset + (r.length || 0);

					if (rStart < end && rEnd > start) {
						if (style === 'link' && r.url) {
							linkUrl = r.url;
						} else if (STYLE_TAGS[style]) {
							tags.push(STYLE_TAGS[style]);
						}
					}
				}
			}
		}

		let inner = escapeHtml(str.slice(start, end));

		for (const tag of tags) {
			inner = `<${tag}>${inner}</${tag}>`;
		}

		if (linkUrl) {
			inner = `<a href="${escapeHtml(linkUrl)}" target="_blank">${inner}</a>`;
		}

		html += inner;
	}

	return html;
}

// Карточка одной задачи Jira: ключ (ссылка), summary, статус, исполнитель.
// Если по задаче нет подробностей (например, не удалось подключиться к Jira),
// выводится только кликабельная ссылка на задачу.
function issueCard(task, jiraUrl) {
	const issueUrl = `${jiraUrl}/browse/${task.issueKey}`;

	const parts = [`<a href="${issueUrl}" target="_blank">${escapeHtml(task.issueKey)}</a>`];

	if (task.summary) {
		parts.push(`<span class="task-summary">${escapeHtml(task.summary)}</span>`);
	}

	if (task.status) {
		parts.push(`<span class="task-status">[${escapeHtml(task.status)}]</span>`);
	}

	if (task.performer) {
		parts.push(`<span class="task-performer">— ${escapeHtml(task.performer)}</span>`);
	}

	return `<li class="task-item">${parts.join(' ')}</li>`;
}

// Полный HTML-документ отчёта.
// reports — массив объектов { chatId, name, text } (уже отсортированный по имени).
// tasksByChat — объект: chatId -> [taskData] (задачи, упомянутые участником в отчёте).
function generateHtml({ reports, total, tasksByChat = {}, jiraUrl = '' }) {
	const readyCount = reports.length;

	const cards = reports
		.map(({ chatId, name, text, format }) => {
			const tasks = tasksByChat[chatId] || [];
			const cardTasks = tasks.length
				? `<div class="tasks-block"><span class="label">Упомянутые задачи:</span><ul>${tasks.map((t) => issueCard(t, jiraUrl)).join('')}</ul></div>`
				: '';

			return `<div class="card">
				<div class="card-title">${escapeHtml(name)}</div>
				<div class="card-body">${renderRichText(text, format)}</div>
				${cardTasks}
			</div>`;
		})
		.join('\n');

	return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Отчёт за день</title>
<style>
	body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #f2f4f7; margin: 0; padding: 20px; color: #333; }
	h1 { margin: 0 0 10px; }
	.summary { color: #666; margin-bottom: 20px; font-size: 14px; }
	.card { background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
	.card-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #2c7be5; }
	.card-body { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
	.tasks-block { margin-top: 10px; padding-top: 8px; border-top: 1px solid #eef0f3; font-size: 13px; }
	.tasks-block ul { margin: 6px 0 0; padding-left: 20px; }
	.tasks-block li { margin-bottom: 4px; }
	.label { font-weight: 600; color: #555; }
	.task-item a { color: #2c7be5; text-decoration: none; font-weight: 600; }
	.task-item a:hover { text-decoration: underline; }
	.task-summary { color: #333; }
	.task-status { color: #5cb85c; font-weight: 600; }
	.task-performer { color: #888; }
	.card-body a { color: #2c7be5; text-decoration: none; font-weight: 600; }
	.card-body a:hover { text-decoration: underline; }
	.card-body code { background: #f0f2f5; border-radius: 4px; padding: 1px 4px; font-size: 13px; }
	.card-body blockquote { margin: 6px 0; padding-left: 12px; border-left: 3px solid #d0d7de; color: #666; }
</style>
</head>
<body>
	<h1>Дейлик</h1>
	<div class="summary">Заполнили отчёт: <b>${readyCount}</b> из <b>${total}</b></div>
	${cards}
</body>
</html>`;
}

module.exports = {
	escapeHtml,
	renderRichText,
	generateHtml,
};
