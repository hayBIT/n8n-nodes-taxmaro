import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { operations } from './operations.generated';

export const paramField = (param: string): string =>
	param === 'id'
		? 'recordId'
		: param.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

const paramLabel = (param: string): string =>
	param === 'id'
		? 'ID'
		: param
				.split('_')
				.map((word) => (word === 'id' ? 'ID' : word[0].toUpperCase() + word.slice(1)))
				.join(' ');

const opsWhere = (predicate: (op: (typeof operations)[number]) => boolean): string[] =>
	operations.filter(predicate).map((op) => op.value);

const resources: INodePropertyOptions[] = [
	...new Map(operations.map((op) => [op.resource, op.resourceName])).entries(),
]
	.map(([value, name]) => ({ name, value }))
	.sort((a, b) => a.name.localeCompare(b.name));

const operationProperties: INodeProperties[] = resources.map(({ value: resource }) => {
	const options: INodePropertyOptions[] = operations
		.filter((op) => op.resource === resource)
		.map((op) => {
			const filters = op.queryParams.filter((q) => q.startsWith('by_'));
			return {
				name: op.name,
				value: op.value,
				action: `${op.name} ${op.resourceName}`.replace(/\s+\(.*\)$/, ''),
				description: filters.length ? `${op.summary} (filters: ${filters.join(', ')})` : op.summary,
			};
		});
	// eslint-disable-next-line n8n-nodes-base/node-param-default-missing
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options,
		default: options[0].value as string,
	};
});

const pathParams = [...new Set(operations.flatMap((op) => op.pathParams))];

const pathParamProperties: INodeProperties[] = pathParams.map((param) => ({
	displayName: paramLabel(param),
	name: paramField(param),
	type: 'string',
	required: true,
	default: '',
	displayOptions: { show: { operation: opsWhere((op) => op.pathParams.includes(param)) } },
}));

const bodyOps = opsWhere((op) => op.body !== null);
const getManyOps = opsWhere((op) => op.kind === 'getMany');
const queryOps = opsWhere((op) => op.queryParams.length > 0 || op.kind === 'getMany');
const binaryOps = opsWhere((op) => op.binary !== null);
const jsonOps = opsWhere((op) => op.binary === null);

const bodyProperties: INodeProperties[] = operations
	.filter((op) => op.body !== null)
	.map((op) => ({
		displayName: 'Body',
		name: `body_${op.value}`,
		type: 'json' as const,
		required: true,
		default: JSON.stringify(op.body, null, 2),
		description: `JSON request body for ${op.method} ${op.path}`,
		displayOptions: { show: { operation: [op.value] } },
	}));

export const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: resources,
		default: 'absenceRequest',
	},
	...operationProperties,
	...pathParamProperties,
	...bodyProperties,
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { operation: getManyOps } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: { show: { operation: getManyOps, returnAll: [false] } },
	},
	{
		displayName: 'Put Output in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		description: 'Name of the binary property that receives the downloaded file',
		displayOptions: { show: { operation: binaryOps } },
	},
	{
		displayName: 'Query Parameters',
		name: 'queryParameters',
		type: 'collection',
		placeholder: 'Add Parameter',
		default: {},
		displayOptions: { show: { operation: queryOps } },
		options: [
			{
				displayName: 'Custom Parameters',
				name: 'custom',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				description:
					'Additional query parameters such as filters (by_year) or arrays (by_ids[]). Add the key exactly as the API expects it.',
				options: [
					{
						displayName: 'Parameter',
						name: 'parameter',
						values: [
							{ displayName: 'Name', name: 'name', type: 'string', default: '' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Items per Page',
				name: 'perPage',
				type: 'number',
				default: 100,
				typeOptions: { minValue: 1 },
				description: 'Page size used while paginating',
			},
			{
				displayName: 'Search Columns',
				name: 'searchColumns',
				type: 'string',
				default: '',
				description: 'Comma-separated list of columns to search in',
			},
			{
				displayName: 'Search Query',
				name: 'searchQuery',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Sort Column',
				name: 'sortColumn',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Sort Direction',
				name: 'sortDirection',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Selected Colleague ID',
				name: 'selectedColleagueId',
				type: 'string',
				default: '',
				description: 'Act in the context of this colleague (sent as a request header)',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to flatten the JSON:API response into plain objects (ID plus attributes)',
				displayOptions: { show: { '/operation': jsonOps } },
			},
		],
	},
];

export { bodyOps };
