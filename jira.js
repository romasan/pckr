const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

async function getIssueData(issueKey) {

	const options = {
		url: `${process.env.JIRA_URL}/rest/api/2/issue/${issueKey}`,
		headers: {
			'Authorization': `Bearer ${process.env.JIRA_TOKEN}`
		}
	};

	// Таймаут запроса к Jira (мс). Задаётся через JIRA_TIMEOUT, по умолчанию 10000 мс.
	const timeout = Number(process.env.JIRA_TIMEOUT) || 10000;

	const response = await axios.get(options.url, {
		headers: options.headers,
		timeout,
	});

	const issue = response.data;

	const tmpDir = __dirname + '/tmp';
	fs.mkdirSync(tmpDir, { recursive: true });
	fs.writeFileSync(tmpDir + '/' + issueKey + '.json', JSON.stringify(issue, null, 2));

	const status = issue.fields?.status?.name || 'нет статуса';
	const summary = issue.fields?.summary || '';
	const performer = issue.fields?.assignee?.displayName || 'Не назначен';
	const sprint = issue.fields?.customfield_15401?.[0]?.split('name=')?.pop()?.split(',')?.shift() || 'нет спринта';

	return {
		issueKey,
		status,
		summary,
		performer,
		sprint,
	};
}

module.exports = {
	getIssueData,
};
