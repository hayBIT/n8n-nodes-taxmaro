import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';

interface JsonApiResource {
	type?: string;
	attributes?: { token?: string };
}

export class TaxmaroApi implements ICredentialType {
	name = 'taxmaroApi';

	displayName = 'Taxmaro API';

	documentationUrl = 'https://github.com/hayBIT/n8n-nodes-taxmaro#credentials';

	icon = { light: 'file:taxmaro.svg', dark: 'file:taxmaro.dark.svg' } as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.taxmaro.com',
			required: true,
		},
		{
			displayName: 'Email',
			name: 'email',
			type: 'string',
			placeholder: 'name@email.com',
			default: '',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Session Token',
			name: 'sessionToken',
			type: 'hidden',
			typeOptions: { expirable: true, password: true },
			default: '',
		},
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const baseUrl = String(credentials.baseUrl).replace(/\/+$/, '');
		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: `${baseUrl}/api/v1/users/sessions`,
			body: { email: credentials.email, password: credentials.password },
			json: true,
		})) as { included?: JsonApiResource[] };

		const token = response.included?.find((item) => item.type === 'auth_token')?.attributes?.token;
		if (!token) {
			throw new Error('Taxmaro login did not return a session token');
		}
		return { sessionToken: token };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.sessionToken}}',
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
