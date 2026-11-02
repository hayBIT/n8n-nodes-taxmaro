import type {
	IDataObject,
	JsonObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { paramField, properties } from './description';
import { operations } from './operations.generated';
import { buildQuery, simplify, taxmaroRequest } from './GenericFunctions';

const operationsByValue = new Map(operations.map((op) => [op.value, op]));

export class Taxmaro implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Taxmaro',
		name: 'taxmaro',
		icon: { light: 'file:taxmaro.svg', dark: 'file:taxmaro.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"]}}',
		description: 'Work with the Taxmaro HR and payroll API',
		defaults: { name: 'Taxmaro' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'taxmaroApi', required: true }],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const op = operationsByValue.get(operation);
				if (!op) {
					throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
						itemIndex: i,
					});
				}

				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const queryParameters = this.getNodeParameter('queryParameters', i, {}) as IDataObject;
				const doSimplify = options.simplify !== false && op.binary === null;

				const path = op.path.replace(/\{(\w+)\}/g, (_match, param: string) =>
					encodeURIComponent(String(this.getNodeParameter(paramField(param), i)).trim()),
				);

				let body: IDataObject | undefined;
				if (op.body !== null) {
					const raw = this.getNodeParameter(`body_${op.value}`, i) as string | IDataObject;
					try {
						body = typeof raw === 'string' ? (JSON.parse(raw) as IDataObject) : raw;
					} catch {
						throw new NodeOperationError(this.getNode(), 'Body is not valid JSON', {
							itemIndex: i,
						});
					}
				}

				const request = {
					method: op.method as IHttpRequestMethods,
					path,
					body,
					selectedColleagueId: options.selectedColleagueId as string | undefined,
				};

				if (op.binary !== null) {
					const response = await taxmaroRequest.call(this, {
						...request,
						qs: buildQuery(queryParameters),
						binary: true,
					});
					const propertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const mimeTypes: Record<string, string> = {
						csv: 'text/csv',
						xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					};
					const binaryData = await this.helpers.prepareBinaryData(
						response as Buffer,
						`${op.resource}.${op.binary}`,
						mimeTypes[op.binary] ?? 'application/octet-stream',
					);
					returnData.push({ json: {}, binary: { [propertyName]: binaryData }, pairedItem: i });
					continue;
				}

				let results: IDataObject[];
				if (op.kind === 'getMany') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
					const perPage = Math.min((queryParameters.perPage as number) || 100, limit);
					results = [];
					let previousFirstId: unknown;
					for (let page = 1; page <= 1000; page++) {
						const response = (await taxmaroRequest.call(this, {
							...request,
							qs: { ...buildQuery(queryParameters), page, per_page: perPage },
						})) as IDataObject;
						const data = response?.data;
						const rows = Array.isArray(data) ? (data as IDataObject[]) : data ? [data as IDataObject] : [];
						// Endpoints without pagination return the same list for every page.
						const firstId = (rows[0] as IDataObject | undefined)?.id;
						if (page > 1 && firstId !== undefined && firstId === previousFirstId) break;
						previousFirstId = firstId;
						results.push(...(doSimplify ? simplify(rows) : [response]));
						if (!doSimplify) break;
						if (rows.length < perPage || results.length >= limit) break;
					}
					if (results.length > limit) results.length = limit;
				} else {
					const qs = op.queryParams.length ? buildQuery(queryParameters) : undefined;
					const response = (await taxmaroRequest.call(this, { ...request, qs })) as unknown;
					if (response === undefined || response === null || response === '') {
						results = [{ success: true }];
					} else if (doSimplify && typeof response === 'object' && 'data' in response) {
						results = simplify((response as IDataObject).data);
					} else {
						results = [response as IDataObject];
					}
				}

				returnData.push(
					...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(results), {
						itemData: { item: i },
					}),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: i,
					});
					continue;
				}
				const alreadyWrapped =
					error instanceof NodeApiError || error instanceof NodeOperationError;
				throw alreadyWrapped
					? (error as NodeApiError)
					: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
