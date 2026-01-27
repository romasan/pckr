const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

async function getIssueData(issueKey) {

	// const issueKeyMatch = issueUrl.match(/\/browse\/([A-Z0-9\-]+)/);
	// if (!issueKeyMatch || !issueKeyMatch[1]) {
	// 	console.error('Не удалось извлечь ключ задачи из ссылки');
	// 	process.exit(1);
	// }
	// const issueKey = issueKeyMatch[1];

	const options = {
		url: `${process.env.JIRA_URL}/rest/api/2/issue/${issueKey}`,
		headers: {
			'Authorization': `Bearer ${process.env.JIRA_TOKEN}`
		}
	};

	const response = await axios.get(options.url, {
		headers: options.headers
	});

	const issue = response.data;

	fs.writeFileSync(__dirname + '/tmp/' + issueKey + '.json', JSON.stringify(issue, null, 2));

	const status = issue.fields.status.name;
	const summary = issue.fields.summary;
	const performer = issue.fields.assignee.displayName;
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
