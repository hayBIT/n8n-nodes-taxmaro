export interface TaxmaroOperation {
	resource: string;
	resourceName: string;
	kind: string;
	label: string;
	scope: string;
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	path: string;
	pathParams: string[];
	queryParams: string[];
	summary: string;
	body: unknown;
	binary: string | null;
	name: string;
	value: string;
}
