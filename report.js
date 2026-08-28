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
		.map(({ chatId, name, text }) => {
			const tasks = tasksByChat[chatId] || [];
			const cardTasks = tasks.length
				? `<div class="tasks-block"><span class="label">Упомянутые задачи:</span><ul>${tasks.map((t) => issueCard(t, jiraUrl)).join('')}</ul></div>`
				: '';

			return `<div class="card">
				<div class="card-title">${escapeHtml(name)}</div>
				<div class="card-body">${escapeHtml(text)}</div>
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
	generateHtml,
};
