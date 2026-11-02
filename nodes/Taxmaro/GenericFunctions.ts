import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

interface TaxmaroRequest {
	method: IHttpRequestMethods;
	path: string;
	qs?: IDataObject;
	body?: IDataObject;
	selectedColleagueId?: string;
	binary?: boolean;
}

export async function taxmaroRequest(this: IExecuteFunctions, request: TaxmaroRequest) {
	const credentials = await this.getCredentials('taxmaroApi');
	const baseUrl = String(credentials.baseUrl).replace(/\/+$/, '');

	const headers: IDataObject = { Accept: request.binary ? '*/*' : 'application/json' };
	if (request.selectedColleagueId) headers.selectedColleagueId = request.selectedColleagueId;

	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${baseUrl}/api/v1${request.path}`,
		headers,
		qs: request.qs,
		body: request.body,
		json: !request.binary,
	};
	if (request.binary) options.encoding = 'arraybuffer';

	return await this.helpers.httpRequestWithAuthentication.call(this, 'taxmaroApi', options);
}

export function buildQuery(parameters: IDataObject): IDataObject {
	const qs: IDataObject = {};
	if (parameters.sortColumn) {
		qs.sorted = { column: parameters.sortColumn, direction: parameters.sortDirection ?? 'asc' };
	}
	if (parameters.searchQuery) {
		const columns = String(parameters.searchColumns ?? '')
			.split(',')
			.map((column) => column.trim())
			.filter(Boolean);
		qs.search = { column: columns, query: parameters.searchQuery };
	}
	const custom = (parameters.custom as IDataObject | undefined)?.parameter as
		| Array<{ name: string; value: string }>
		| undefined;
	for (const { name, value } of custom ?? []) {
		if (name) qs[name] = value;
	}
	return qs;
}

interface JsonApiResource {
	id?: string;
	attributes?: IDataObject;
	relationships?: Record<string, { data?: { id: string } | Array<{ id: string }> | null }>;
}

export function simplify(data: unknown): IDataObject[] {
	const resources = (Array.isArray(data) ? data : data ? [data] : []) as JsonApiResource[];
	return resources.map((resource) => {
		const flat: IDataObject = { id: resource.id, ...resource.attributes };
		for (const [name, relation] of Object.entries(resource.relationships ?? {})) {
			if (relation.data === undefined) continue;
			flat[Array.isArray(relation.data) ? `${name}_ids` : `${name}_id`] = Array.isArray(
				relation.data,
			)
				? relation.data.map((entry) => entry.id)
				: (relation.data?.id ?? null);
		}
		return flat;
	});
}
