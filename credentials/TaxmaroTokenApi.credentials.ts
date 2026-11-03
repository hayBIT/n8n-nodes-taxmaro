import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TaxmaroTokenApi implements ICredentialType {
	name = 'taxmaroTokenApi';

	displayName = 'Taxmaro API Token API';

	documentationUrl = 'https://github.com/hayBIT/n8n-nodes-taxmaro#credentials';

	icon = { light: 'file:taxmaro.svg', dark: 'file:taxmaro.dark.svg' } as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.taxmaro.com',
			required: true,
			description:
				'Address of the Taxmaro API. Use https://app.taxmaro.com, also if your instance has its own web address.',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Create it in the Taxmaro web interface under "API-Token"',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/v1/countries',
			qs: { per_page: 1 },
			headers: { Accept: 'application/json' },
		},
	};
}
